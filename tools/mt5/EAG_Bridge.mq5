//+------------------------------------------------------------------+
//|                                                   EAG_Bridge.mq5 |
//|                 Puente EAG Charts <-> MetaTrader 5               |
//|                                   El Arte Gráfico · elartegrafico.com |
//+------------------------------------------------------------------+
#property copyright "El Arte Gráfico"
#property link      "https://elartegrafico.com"
#property version   "1.01"
#property description "Conecta MT5 con EAG Charts: envía cuenta, posiciones, órdenes e historial,"
#property description "y ejecuta lo que mandes desde los charts (mercado, pendientes, SL/TP, cierres)."

#include <Trade\Trade.mqh>

//--- Entradas
input group "Conexión"
input string InpServerURL    = "https://animmecpzvhvnwzjljxg.supabase.co";   // URL de Supabase de El Arte Gráfico (no la cambies)
input string InpSupabaseKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc"; // Clave pública de Supabase (no la cambies)
input string InpEAToken      = "";                        // Token del EA: lo generas en EAG Charts → Operar → MT5
input int    InpPollMs       = 1000;                      // Frecuencia de sincronización (ms)
input int    InpTimeoutMs    = 4000;                      // Timeout de cada petición (ms)

input group "Ejecución"
input bool   InpAllowTrading = true;                      // Permitir ejecutar operaciones desde los charts
input ulong  InpMagic        = 770077;                    // Número mágico de las operaciones de EAG Charts
input int    InpSlippagePts  = 30;                        // Desviación máxima (puntos)
input double InpMaxLots      = 50.0;                      // Lotaje máximo por orden (seguridad)
input string InpSymbolSuffix = "";                        // Sufijo del broker (ej: .m) si tus símbolos lo usan

input group "Otros"
input int    InpHistorySec   = 5;                         // Cada cuántos segundos refrescar el historial del día
input bool   InpVerbose      = true;                      // Escribir en el diario lo que se ejecuta

//--- Estado
CTrade   g_trade;
string   g_watch[];          // símbolos con cotización en vivo para el panel
string   g_results[];        // resultados pendientes de reportar (JSON)
string   g_doneIds[];        // ids ya ejecutados (evita duplicados)
int      g_donePos     = 0;
datetime g_lastOk      = 0;
int      g_fails       = 0;
long     g_execCount   = 0;
string   g_historyJson = "[]";
double   g_todayPnl    = 0.0;
int      g_todayTrades = 0;
datetime g_lastHistory = 0;
long     g_tzOffset    = 0;  // segundos: hora servidor - UTC
string   g_lastError   = "";
string   g_lastPrinted = "";

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpSlippagePts);
   g_trade.SetAsyncMode(false);
   g_trade.LogLevel(LOG_LEVEL_ERRORS);

   ArrayResize(g_doneIds, 300);
   for(int i = 0; i < ArraySize(g_doneIds); i++)
      g_doneIds[i] = "";

   int ms = (int)MathMax(InpPollMs, 200);
   if(!EventSetMillisecondTimer(ms))
     {
      Print("EAG Bridge: no se pudo iniciar el temporizador");
      return(INIT_FAILED);
     }
   AddWatch(_Symbol);
   RefreshHistory();
   UpdateStatus();
   Print("EAG Bridge iniciado. Servidor: ", InpServerURL);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

//+------------------------------------------------------------------+
void OnTick() { }

//+------------------------------------------------------------------+
void OnTimer()
  {
   Sync();
   // Si se ejecutó algo, sincronizamos otra vez de inmediato para que el panel lo vea al instante
   if(ArraySize(g_results) > 0)
      Sync();
  }

//+------------------------------------------------------------------+
//| Utilidades                                                       |
//+------------------------------------------------------------------+
string J(string s)
  {
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   StringReplace(r, "\n", "\\n");
   StringReplace(r, "\r", "\\r");
   StringReplace(r, "\t", "\\t");
   return("\"" + r + "\"");
  }

string D(double v, int digits)
  {
   if(!MathIsValidNumber(v))
      return("0");
   return(DoubleToString(v, digits));
  }

long ToUtc(datetime t)
  {
   if(t == 0)
      return(0);
   return((long)t - g_tzOffset);
  }

int VolDigits(string sym)
  {
   double st = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   if(st <= 0)
      return(2);
   int d = (int)MathCeil(-MathLog10(st) - 1e-9);
   if(d < 0)
      d = 0;
   if(d > 8)
      d = 8;
   return(d);
  }

bool Has(string v) { return(v != "-" && v != ""); }

string PosTypeName(long t) { return(t == POSITION_TYPE_BUY ? "buy" : "sell"); }

string OrdTypeName(long t)
  {
   switch((int)t)
     {
      case ORDER_TYPE_BUY_LIMIT:       return("buy_limit");
      case ORDER_TYPE_SELL_LIMIT:      return("sell_limit");
      case ORDER_TYPE_BUY_STOP:        return("buy_stop");
      case ORDER_TYPE_SELL_STOP:       return("sell_stop");
      case ORDER_TYPE_BUY_STOP_LIMIT:  return("buy_stop_limit");
      case ORDER_TYPE_SELL_STOP_LIMIT: return("sell_stop_limit");
      case ORDER_TYPE_BUY:             return("buy");
      case ORDER_TYPE_SELL:            return("sell");
     }
   return("other");
  }

bool ParsePendingType(string s, ENUM_ORDER_TYPE &t)
  {
   if(s == "buy_limit")       { t = ORDER_TYPE_BUY_LIMIT;       return(true); }
   if(s == "sell_limit")      { t = ORDER_TYPE_SELL_LIMIT;      return(true); }
   if(s == "buy_stop")        { t = ORDER_TYPE_BUY_STOP;        return(true); }
   if(s == "sell_stop")       { t = ORDER_TYPE_SELL_STOP;       return(true); }
   if(s == "buy_stop_limit")  { t = ORDER_TYPE_BUY_STOP_LIMIT;  return(true); }
   if(s == "sell_stop_limit") { t = ORDER_TYPE_SELL_STOP_LIMIT; return(true); }
   return(false);
  }

string ResolveSymbol(string s)
  {
   if(s == "" || s == "-")
      return("");
   if(SymbolSelect(s, true))
      return(s);
   if(InpSymbolSuffix != "" && SymbolSelect(s + InpSymbolSuffix, true))
      return(s + InpSymbolSuffix);
   return("");
  }

void AddWatch(string s)
  {
   if(s == "")
      return;
   int n = ArraySize(g_watch);
   for(int i = 0; i < n; i++)
      if(g_watch[i] == s)
         return;
   if(n >= 30)
     {
      for(int i = 0; i < n - 1; i++)
         g_watch[i] = g_watch[i + 1];
      g_watch[n - 1] = s;
      return;
     }
   ArrayResize(g_watch, n + 1);
   g_watch[n] = s;
  }

double NormPrice(string sym, double p)
  {
   if(p <= 0)
      return(0.0);
   double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   int    dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   if(ts > 0)
      p = MathRound(p / ts) * ts;
   return(NormalizeDouble(p, dg));
  }

bool NormVolume(string sym, double req, double &out, string &err)
  {
   double mn = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double mx = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double st = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   if(req <= 0)
     {
      err = "Lotaje inválido";
      return(false);
     }
   if(req > InpMaxLots + 1e-9)
     {
      err = "El lotaje supera el máximo del EA (" + D(InpMaxLots, 2) + ")";
      return(false);
     }
   if(st <= 0)
      st = 0.01;
   double v = MathFloor(req / st + 1e-7) * st;
   if(v < mn - 1e-9)
     {
      err = "Lotaje menor al mínimo del símbolo (" + D(mn, VolDigits(sym)) + ")";
      return(false);
     }
   if(mx > 0 && v > mx)
      v = mx;
   out = NormalizeDouble(v, VolDigits(sym));
   return(true);
  }

string CleanComment(string c)
  {
   if(!Has(c))
      return("EAG Charts");
   if(StringLen(c) > 31)
      c = StringSubstr(c, 0, 31);
   return(c);
  }

//+------------------------------------------------------------------+
//| Resultados y control de duplicados                               |
//+------------------------------------------------------------------+
bool IsDone(string id)
  {
   for(int i = 0; i < ArraySize(g_doneIds); i++)
      if(g_doneIds[i] == id)
         return(true);
   return(false);
  }

void MarkDone(string id)
  {
   g_doneIds[g_donePos] = id;
   g_donePos = (g_donePos + 1) % ArraySize(g_doneIds);
  }

void AddResult(string id, bool ok, long code, string msg, ulong ticket, double price, string sym = "")
  {
   string r = "{\"id\":" + J(id) +
              ",\"ok\":" + (ok ? "true" : "false") +
              ",\"code\":" + IntegerToString(code) +
              ",\"msg\":" + J(msg) +
              ",\"ticket\":" + (string)ticket +
              ",\"price\":" + D(price, 8) +
              ",\"symbol\":" + J(sym) + "}";
   int n = ArraySize(g_results);
   ArrayResize(g_results, n + 1);
   g_results[n] = r;
   if(InpVerbose)
      Print("EAG Bridge [", id, "] ", (ok ? "OK" : "ERROR"), " ", msg);
  }

bool TradeOk()
  {
   uint rc = g_trade.ResultRetcode();
   return(rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_DONE_PARTIAL || rc == TRADE_RETCODE_PLACED);
  }

void ReportTrade(string id, bool sent, string sym)
  {
   bool ok = sent && TradeOk();
   string msg = g_trade.ResultRetcodeDescription();
   if(!sent && g_trade.ResultRetcode() == 0)
      msg = "Error " + IntegerToString(GetLastError());
   AddResult(id, ok, (long)g_trade.ResultRetcode(), msg, g_trade.ResultOrder(), g_trade.ResultPrice(), sym);
   if(ok)
      g_execCount++;
  }

void RemoveFirstResults(int n)
  {
   int total = ArraySize(g_results);
   if(n <= 0)
      return;
   if(n >= total)
     {
      ArrayResize(g_results, 0);
      return;
     }
   for(int i = n; i < total; i++)
      g_results[i - n] = g_results[i];
   ArrayResize(g_results, total - n);
  }

//+------------------------------------------------------------------+
//| JSON de estado                                                   |
//+------------------------------------------------------------------+
string AccountJson()
  {
   string tm = "real";
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_DEMO)
      tm = "demo";
   else
      if(mode == ACCOUNT_TRADE_MODE_CONTEST)
         tm = "contest";

   string mm = "hedging";
   long mmode = AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   if(mmode == ACCOUNT_MARGIN_MODE_RETAIL_NETTING)
      mm = "netting";
   else
      if(mmode == ACCOUNT_MARGIN_MODE_EXCHANGE)
         mm = "exchange";

   bool algo = (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) != 0) && (MQLInfoInteger(MQL_TRADE_ALLOWED) != 0);
   bool acc  = (AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) != 0);

   string s = "{";
   s += "\"login\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   s += ",\"name\":" + J(AccountInfoString(ACCOUNT_NAME));
   s += ",\"server\":" + J(AccountInfoString(ACCOUNT_SERVER));
   s += ",\"company\":" + J(AccountInfoString(ACCOUNT_COMPANY));
   s += ",\"currency\":" + J(AccountInfoString(ACCOUNT_CURRENCY));
   s += ",\"leverage\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE));
   s += ",\"balance\":" + D(AccountInfoDouble(ACCOUNT_BALANCE), 2);
   s += ",\"equity\":" + D(AccountInfoDouble(ACCOUNT_EQUITY), 2);
   s += ",\"margin\":" + D(AccountInfoDouble(ACCOUNT_MARGIN), 2);
   s += ",\"free_margin\":" + D(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2);
   s += ",\"margin_level\":" + D(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2);
   s += ",\"profit\":" + D(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   s += ",\"credit\":" + D(AccountInfoDouble(ACCOUNT_CREDIT), 2);
   s += ",\"trade_mode\":\"" + tm + "\"";
   s += ",\"margin_mode\":\"" + mm + "\"";
   s += ",\"algo_trading\":" + (algo ? "true" : "false");
   s += ",\"account_trade_allowed\":" + (acc ? "true" : "false");
   s += ",\"ea_trading\":" + (InpAllowTrading ? "true" : "false");
   s += ",\"max_lots\":" + D(InpMaxLots, 2);
   s += ",\"magic\":" + (string)InpMagic;
   s += ",\"tz_offset\":" + IntegerToString(g_tzOffset);
   s += ",\"ea_version\":\"1.01\"";
   s += "}";
   return(s);
  }

string PositionsJson()
  {
   string s = "[";
   int c = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0)
         continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(c > 0)
         s += ",";
      c++;
      s += "{\"ticket\":" + (string)t;
      s += ",\"symbol\":" + J(sym);
      s += ",\"type\":\"" + PosTypeName(PositionGetInteger(POSITION_TYPE)) + "\"";
      s += ",\"volume\":" + D(PositionGetDouble(POSITION_VOLUME), VolDigits(sym));
      s += ",\"open_price\":" + D(PositionGetDouble(POSITION_PRICE_OPEN), dg);
      s += ",\"current_price\":" + D(PositionGetDouble(POSITION_PRICE_CURRENT), dg);
      s += ",\"sl\":" + D(PositionGetDouble(POSITION_SL), dg);
      s += ",\"tp\":" + D(PositionGetDouble(POSITION_TP), dg);
      s += ",\"profit\":" + D(PositionGetDouble(POSITION_PROFIT), 2);
      s += ",\"swap\":" + D(PositionGetDouble(POSITION_SWAP), 2);
      s += ",\"magic\":" + IntegerToString(PositionGetInteger(POSITION_MAGIC));
      s += ",\"comment\":" + J(PositionGetString(POSITION_COMMENT));
      s += ",\"time\":" + IntegerToString(ToUtc((datetime)PositionGetInteger(POSITION_TIME)));
      s += ",\"digits\":" + IntegerToString(dg);
      s += "}";
      AddWatch(sym);
     }
   s += "]";
   return(s);
  }

string OrdersJson()
  {
   string s = "[";
   int c = 0;
   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
     {
      ulong t = OrderGetTicket(i);
      if(t == 0)
         continue;
      string sym = OrderGetString(ORDER_SYMBOL);
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(c > 0)
         s += ",";
      c++;
      s += "{\"ticket\":" + (string)t;
      s += ",\"symbol\":" + J(sym);
      s += ",\"type\":\"" + OrdTypeName(OrderGetInteger(ORDER_TYPE)) + "\"";
      s += ",\"volume\":" + D(OrderGetDouble(ORDER_VOLUME_CURRENT), VolDigits(sym));
      s += ",\"price\":" + D(OrderGetDouble(ORDER_PRICE_OPEN), dg);
      s += ",\"stoplimit\":" + D(OrderGetDouble(ORDER_PRICE_STOPLIMIT), dg);
      s += ",\"current_price\":" + D(OrderGetDouble(ORDER_PRICE_CURRENT), dg);
      s += ",\"sl\":" + D(OrderGetDouble(ORDER_SL), dg);
      s += ",\"tp\":" + D(OrderGetDouble(ORDER_TP), dg);
      s += ",\"magic\":" + IntegerToString(OrderGetInteger(ORDER_MAGIC));
      s += ",\"comment\":" + J(OrderGetString(ORDER_COMMENT));
      s += ",\"time\":" + IntegerToString(ToUtc((datetime)OrderGetInteger(ORDER_TIME_SETUP)));
      s += ",\"expiration\":" + IntegerToString(ToUtc((datetime)OrderGetInteger(ORDER_TIME_EXPIRATION)));
      s += ",\"digits\":" + IntegerToString(dg);
      s += "}";
      AddWatch(sym);
     }
   s += "]";
   return(s);
  }

string SymbolsJson()
  {
   string s = "[";
   int c = 0;
   for(int i = 0; i < ArraySize(g_watch); i++)
     {
      string sym = g_watch[i];
      MqlTick tk;
      if(!SymbolInfoTick(sym, tk))
         continue;
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(c > 0)
         s += ",";
      c++;
      s += "{\"symbol\":" + J(sym);
      s += ",\"description\":" + J(SymbolInfoString(sym, SYMBOL_DESCRIPTION));
      s += ",\"bid\":" + D(tk.bid, dg);
      s += ",\"ask\":" + D(tk.ask, dg);
      s += ",\"digits\":" + IntegerToString(dg);
      s += ",\"point\":" + D(SymbolInfoDouble(sym, SYMBOL_POINT), 10);
      s += ",\"tick_size\":" + D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE), 10);
      s += ",\"tick_value\":" + D(SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE), 10);
      s += ",\"contract_size\":" + D(SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE), 4);
      s += ",\"vol_min\":" + D(SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), 8);
      s += ",\"vol_max\":" + D(SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX), 8);
      s += ",\"vol_step\":" + D(SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), 8);
      s += ",\"stops_level\":" + IntegerToString(SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL));
      s += ",\"trade_mode\":" + IntegerToString(SymbolInfoInteger(sym, SYMBOL_TRADE_MODE));
      s += "}";
     }
   s += "]";
   return(s);
  }

void RefreshHistory()
  {
   datetime now = TimeTradeServer();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   dt.hour = 0;
   dt.min  = 0;
   dt.sec  = 0;
   datetime dayStart = StructToTime(dt);
   if(!HistorySelect(dayStart, now + 3600))
      return;

   double pnl = 0.0;
   int cnt = 0, added = 0;
   string items = "";
   int n = HistoryDealsTotal();
   for(int i = n - 1; i >= 0; i--)
     {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0)
         continue;
      long dtype = HistoryDealGetInteger(d, DEAL_TYPE);
      if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL)
         continue;
      double net = HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_SWAP) +
                   HistoryDealGetDouble(d, DEAL_COMMISSION) + HistoryDealGetDouble(d, DEAL_FEE);
      pnl += net;
      long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT && entry != DEAL_ENTRY_OUT_BY)
         continue;
      cnt++;
      if(added >= 40)
         continue;
      string sym = HistoryDealGetString(d, DEAL_SYMBOL);
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      // El trato de salida va en sentido contrario a la posición
      string side = (dtype == DEAL_TYPE_SELL) ? "buy" : "sell";
      if(added > 0)
         items += ",";
      added++;
      items += "{\"deal\":" + (string)d;
      items += ",\"position\":" + IntegerToString(HistoryDealGetInteger(d, DEAL_POSITION_ID));
      items += ",\"symbol\":" + J(sym);
      items += ",\"type\":\"" + side + "\"";
      items += ",\"volume\":" + D(HistoryDealGetDouble(d, DEAL_VOLUME), VolDigits(sym));
      items += ",\"price\":" + D(HistoryDealGetDouble(d, DEAL_PRICE), dg);
      items += ",\"profit\":" + D(net, 2);
      items += ",\"time\":" + IntegerToString(ToUtc((datetime)HistoryDealGetInteger(d, DEAL_TIME)));
      items += "}";
     }
   g_historyJson = "[" + items + "]";
   g_todayPnl = pnl;
   g_todayTrades = cnt;
  }

string BuildBody()
  {
   int nRes = ArraySize(g_results);
   string res = "";
   for(int i = 0; i < nRes; i++)
     {
      if(i > 0)
         res += ",";
      res += g_results[i];
     }
   // Primero posiciones y órdenes (agregan sus símbolos a la lista de cotizaciones)
   string pos = PositionsJson();
   string ord = OrdersJson();
   string s = "{\"v\":1";
   s += ",\"account\":" + AccountJson();
   s += ",\"positions\":" + pos;
   s += ",\"orders\":" + ord;
   s += ",\"symbols\":" + SymbolsJson();
   s += ",\"history\":" + g_historyJson;
   s += ",\"today\":{\"pnl\":" + D(g_todayPnl, 2) + ",\"trades\":" + IntegerToString(g_todayTrades) + "}";
   s += ",\"results\":[" + res + "]";
   s += "}";
   return(s);
  }

//+------------------------------------------------------------------+
//| Sincronización con el servidor                                   |
//+------------------------------------------------------------------+
void SetError(string e)
  {
   g_lastError = e;
   if(e != g_lastPrinted)
     {
      Print("EAG Bridge: ", e);
      g_lastPrinted = e;
     }
  }

void Sync()
  {
   g_tzOffset = (long)MathRound((double)(TimeTradeServer() - TimeGMT()) / 900.0) * 900;

   if(TimeLocal() - g_lastHistory >= InpHistorySec)
     {
      RefreshHistory();
      g_lastHistory = TimeLocal();
     }

   int nRes = ArraySize(g_results);
   string body = "{\"p\":" + BuildBody() + "}";

   char data[], res[];
   string rh;
   int n = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(n > 0)
      ArrayResize(data, n - 1);   // quitar el \0 final

   if(InpEAToken == "")
     {
      SetError("Falta el token: genéralo en EAG Charts → Operar → MT5 y pégalo en InpEAToken");
      UpdateStatus();
      return;
     }
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\napikey: " + InpSupabaseKey +
                    "\r\nAuthorization: Bearer " + InpSupabaseKey + "\r\nX-EAG-Token: " + InpEAToken + "\r\n";
   string url = InpServerURL + "/rest/v1/rpc/mt5_ea_sync";

   ResetLastError();
   int code = WebRequest("POST", url, headers, InpTimeoutMs, data, res, rh);
   if(code == -1)
     {
      int e = GetLastError();
      g_fails++;
      if(e == 4014)
         SetError("Permite la URL en Herramientas > Opciones > Asesores Expertos > WebRequest: " + InpServerURL);
      else
         SetError("Sin conexión con el servidor (error " + IntegerToString(e) + ")");
      UpdateStatus();
      return;
     }

   string resp = CharArrayToString(res, 0, WHOLE_ARRAY, CP_UTF8);
   // Si Supabase responde en JSON ("OK|...\nCMD|..."), se quitan las comillas
   if(StringLen(resp) > 1 && StringGetCharacter(resp, 0) == '"')
     {
      resp = StringSubstr(resp, 1, StringLen(resp) - 2);
      StringReplace(resp, "\\n", "\n");
      StringReplace(resp, "\\\"", "\"");
      StringReplace(resp, "\\\\", "\\");
     }
   if(code != 200)
     {
      g_fails++;
      if(code == 401)
         SetError("Token del EA incorrecto (revisa InpEAToken)");
      else
         SetError("El servidor respondió " + IntegerToString(code) + ": " + StringSubstr(resp, 0, 80));
      UpdateStatus();
      return;
     }

   // Los resultados ya llegaron al servidor
   RemoveFirstResults(nRes);
   g_fails = 0;
   g_lastOk = TimeLocal();
   if(g_lastError != "")
     {
      Print("EAG Bridge: conexión restablecida");
      g_lastPrinted = "";
     }
   g_lastError = "";

   ProcessResponse(resp);
   UpdateStatus();
  }

void ProcessResponse(string resp)
  {
   string lines[];
   int n = StringSplit(resp, '\n', lines);
   for(int i = 0; i < n; i++)
     {
      string ln = lines[i];
      StringReplace(ln, "\r", "");
      if(StringLen(ln) < 4 || StringSubstr(ln, 0, 4) != "CMD|")
         continue;
      string f[];
      int k = StringSplit(ln, '|', f);
      if(k < 14 || f[13] != "E")
        {
         Print("EAG Bridge: comando mal formado, ignorado: ", ln);
         continue;
        }
      ExecuteCommand(f);
     }
  }

//+------------------------------------------------------------------+
//| Ejecución de comandos                                            |
//| CMD|id|accion|simbolo|tipo|volumen|precio|sl|tp|ticket|expira|stoplimit|comentario|E
//+------------------------------------------------------------------+
void ExecuteCommand(string &f[])
  {
   string id     = f[1];
   string action = f[2];

   if(IsDone(id))
      return;
   MarkDone(id);

   if(action == "watch")
     {
      string ws = ResolveSymbol(f[3]);
      if(ws == "")
        {
         AddResult(id, false, 0, "Símbolo no encontrado en MT5: " + f[3], 0, 0, f[3]);
         return;
        }
      AddWatch(ws);
      AddResult(id, true, 0, "Símbolo activo: " + ws, 0, 0, ws);
      return;
     }

   if(!InpAllowTrading)
     {
      AddResult(id, false, 0, "La ejecución está desactivada en el EA", 0, 0);
      return;
     }
   if(TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) == 0 || MQLInfoInteger(MQL_TRADE_ALLOWED) == 0)
     {
      AddResult(id, false, 0, "Activa 'Algo Trading' en MT5 y permite operar al EA", 0, 0);
      return;
     }

   if(action == "open_market")      { CmdOpenMarket(f);    return; }
   if(action == "open_pending")     { CmdOpenPending(f);   return; }
   if(action == "modify_position")  { CmdModifyPosition(f); return; }
   if(action == "close_position")   { CmdClosePosition(f); return; }
   if(action == "modify_order")     { CmdModifyOrder(f);   return; }
   if(action == "cancel_order")     { CmdCancelOrder(f);   return; }
   if(action == "close_all")        { CmdCloseAll(f);      return; }
   if(action == "cancel_all")       { CmdCancelAll(f);     return; }

   AddResult(id, false, 0, "Acción desconocida: " + action, 0, 0);
  }

void CmdOpenMarket(string &f[])
  {
   string id = f[1];
   string sym = ResolveSymbol(f[3]);
   if(sym == "")
     {
      AddResult(id, false, 0, "Símbolo no encontrado en MT5: " + f[3], 0, 0, f[3]);
      return;
     }
   AddWatch(sym);
   double vol;
   string err;
   if(!NormVolume(sym, StringToDouble(f[5]), vol, err))
     {
      AddResult(id, false, 0, err, 0, 0, sym);
      return;
     }
   double sl = Has(f[7]) ? NormPrice(sym, StringToDouble(f[7])) : 0.0;
   double tp = Has(f[8]) ? NormPrice(sym, StringToDouble(f[8])) : 0.0;
   string cm = CleanComment(f[12]);

   g_trade.SetTypeFillingBySymbol(sym);
   bool sent = false;
   if(f[4] == "buy")
      sent = g_trade.Buy(vol, sym, 0.0, sl, tp, cm);
   else
      if(f[4] == "sell")
         sent = g_trade.Sell(vol, sym, 0.0, sl, tp, cm);
      else
        {
         AddResult(id, false, 0, "Dirección inválida (buy/sell)", 0, 0, sym);
         return;
        }
   ReportTrade(id, sent, sym);
  }

void CmdOpenPending(string &f[])
  {
   string id = f[1];
   string sym = ResolveSymbol(f[3]);
   if(sym == "")
     {
      AddResult(id, false, 0, "Símbolo no encontrado en MT5: " + f[3], 0, 0, f[3]);
      return;
     }
   AddWatch(sym);
   ENUM_ORDER_TYPE ot;
   if(!ParsePendingType(f[4], ot))
     {
      AddResult(id, false, 0, "Tipo de orden pendiente inválido: " + f[4], 0, 0, sym);
      return;
     }
   double vol;
   string err;
   if(!NormVolume(sym, StringToDouble(f[5]), vol, err))
     {
      AddResult(id, false, 0, err, 0, 0, sym);
      return;
     }
   double price = NormPrice(sym, StringToDouble(f[6]));
   if(price <= 0)
     {
      AddResult(id, false, 0, "Precio de la orden inválido", 0, 0, sym);
      return;
     }
   double sl = Has(f[7]) ? NormPrice(sym, StringToDouble(f[7])) : 0.0;
   double tp = Has(f[8]) ? NormPrice(sym, StringToDouble(f[8])) : 0.0;
   double stoplimit = Has(f[11]) ? NormPrice(sym, StringToDouble(f[11])) : 0.0;
   if((ot == ORDER_TYPE_BUY_STOP_LIMIT || ot == ORDER_TYPE_SELL_STOP_LIMIT) && stoplimit <= 0)
     {
      AddResult(id, false, 0, "Falta el precio límite de la orden Stop Limit", 0, 0, sym);
      return;
     }

   ENUM_ORDER_TYPE_TIME tt = ORDER_TIME_GTC;
   datetime exp = 0;
   if(Has(f[10]))
     {
      long u = StringToInteger(f[10]);
      if(u > 0)
        {
         exp = (datetime)(u + g_tzOffset);
         tt = ORDER_TIME_SPECIFIED;
        }
     }
   g_trade.SetTypeFillingBySymbol(sym);
   bool sent = g_trade.OrderOpen(sym, ot, vol, stoplimit, price, sl, tp, tt, exp, CleanComment(f[12]));
   ReportTrade(id, sent, sym);
  }

void CmdModifyPosition(string &f[])
  {
   string id = f[1];
   ulong tk = (ulong)StringToInteger(f[9]);
   if(!PositionSelectByTicket(tk))
     {
      AddResult(id, false, 0, "Posición no encontrada: " + f[9], tk, 0);
      return;
     }
   string sym = PositionGetString(POSITION_SYMBOL);
   double sl = Has(f[7]) ? NormPrice(sym, StringToDouble(f[7])) : PositionGetDouble(POSITION_SL);
   double tp = Has(f[8]) ? NormPrice(sym, StringToDouble(f[8])) : PositionGetDouble(POSITION_TP);
   bool sent = g_trade.PositionModify(tk, sl, tp);
   ReportTrade(id, sent, sym);
  }

void CmdClosePosition(string &f[])
  {
   string id = f[1];
   ulong tk = (ulong)StringToInteger(f[9]);
   if(!PositionSelectByTicket(tk))
     {
      AddResult(id, false, 0, "Posición no encontrada: " + f[9], tk, 0);
      return;
     }
   string sym = PositionGetString(POSITION_SYMBOL);
   double pv = PositionGetDouble(POSITION_VOLUME);
   double req = Has(f[5]) ? StringToDouble(f[5]) : 0.0;
   g_trade.SetTypeFillingBySymbol(sym);
   bool sent;
   if(req > 0 && req < pv - 1e-9)
     {
      double vol;
      string err;
      if(!NormVolume(sym, req, vol, err))
        {
         AddResult(id, false, 0, err, tk, 0, sym);
         return;
        }
      sent = g_trade.PositionClosePartial(tk, vol);
     }
   else
      sent = g_trade.PositionClose(tk);
   ReportTrade(id, sent, sym);
  }

void CmdModifyOrder(string &f[])
  {
   string id = f[1];
   ulong tk = (ulong)StringToInteger(f[9]);
   if(!OrderSelect(tk))
     {
      AddResult(id, false, 0, "Orden no encontrada: " + f[9], tk, 0);
      return;
     }
   string sym = OrderGetString(ORDER_SYMBOL);
   double price = Has(f[6])  ? NormPrice(sym, StringToDouble(f[6]))  : OrderGetDouble(ORDER_PRICE_OPEN);
   double sl    = Has(f[7])  ? NormPrice(sym, StringToDouble(f[7]))  : OrderGetDouble(ORDER_SL);
   double tp    = Has(f[8])  ? NormPrice(sym, StringToDouble(f[8]))  : OrderGetDouble(ORDER_TP);
   double stl   = Has(f[11]) ? NormPrice(sym, StringToDouble(f[11])) : OrderGetDouble(ORDER_PRICE_STOPLIMIT);
   ENUM_ORDER_TYPE_TIME tt = (ENUM_ORDER_TYPE_TIME)OrderGetInteger(ORDER_TYPE_TIME);
   datetime exp = (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
   if(Has(f[10]))
     {
      long u = StringToInteger(f[10]);
      if(u > 0)
        {
         exp = (datetime)(u + g_tzOffset);
         tt = ORDER_TIME_SPECIFIED;
        }
      else
        {
         exp = 0;
         tt = ORDER_TIME_GTC;
        }
     }
   bool sent = g_trade.OrderModify(tk, price, sl, tp, tt, exp, stl);
   ReportTrade(id, sent, sym);
  }

void CmdCancelOrder(string &f[])
  {
   string id = f[1];
   ulong tk = (ulong)StringToInteger(f[9]);
   if(!OrderSelect(tk))
     {
      AddResult(id, false, 0, "Orden no encontrada: " + f[9], tk, 0);
      return;
     }
   string sym = OrderGetString(ORDER_SYMBOL);
   bool sent = g_trade.OrderDelete(tk);
   ReportTrade(id, sent, sym);
  }

// filtro (campo tipo): all | profit | loss | buy | sell ; símbolo opcional
void CmdCloseAll(string &f[])
  {
   string id = f[1];
   string symF = Has(f[3]) ? f[3] : "";
   string flt = Has(f[4]) ? f[4] : "all";
   int closed = 0, failed = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0)
         continue;
      string s = PositionGetString(POSITION_SYMBOL);
      if(symF != "" && s != symF && s != symF + InpSymbolSuffix)
         continue;
      double pr = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      long ty = PositionGetInteger(POSITION_TYPE);
      if(flt == "profit" && pr <= 0)
         continue;
      if(flt == "loss" && pr >= 0)
         continue;
      if(flt == "buy" && ty != POSITION_TYPE_BUY)
         continue;
      if(flt == "sell" && ty != POSITION_TYPE_SELL)
         continue;
      g_trade.SetTypeFillingBySymbol(s);
      if(g_trade.PositionClose(t) && TradeOk())
         closed++;
      else
         failed++;
     }
   if(closed > 0)
      g_execCount++;
   string msg = "Posiciones cerradas: " + IntegerToString(closed);
   if(failed > 0)
      msg += " | Fallaron: " + IntegerToString(failed);
   AddResult(id, failed == 0, 0, msg, 0, 0, symF);
  }

void CmdCancelAll(string &f[])
  {
   string id = f[1];
   string symF = Has(f[3]) ? f[3] : "";
   int done = 0, failed = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong t = OrderGetTicket(i);
      if(t == 0)
         continue;
      string s = OrderGetString(ORDER_SYMBOL);
      if(symF != "" && s != symF && s != symF + InpSymbolSuffix)
         continue;
      if(g_trade.OrderDelete(t) && TradeOk())
         done++;
      else
         failed++;
     }
   string msg = "Órdenes canceladas: " + IntegerToString(done);
   if(failed > 0)
      msg += " | Fallaron: " + IntegerToString(failed);
   AddResult(id, failed == 0, 0, msg, 0, 0, symF);
  }

//+------------------------------------------------------------------+
void UpdateStatus()
  {
   string st = (g_lastOk > 0 && g_fails == 0) ? "CONECTADO" : "SIN CONEXIÓN";
   string s = "EAG Bridge v1.01  |  " + st;
   s += "\nServidor: " + InpServerURL;
   s += "\nÚltima sincronización: " + (g_lastOk > 0 ? TimeToString(g_lastOk, TIME_SECONDS) : "-");
   s += "\nEjecución desde charts: " + (InpAllowTrading ? "ACTIVA" : "DESACTIVADA");
   s += "\nOperaciones ejecutadas: " + IntegerToString(g_execCount);
   if(g_lastError != "")
      s += "\n(!) " + g_lastError;
   Comment(s);
  }
//+------------------------------------------------------------------+
