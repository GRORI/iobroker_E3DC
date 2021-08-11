/*****************************************************************************************
    Version: 0.3.0  Der % Wert Batterieentladung E3DC durch Wallbox ist in VIS variable einstellbar, dadurch entfällt Einstellung 5
                    Achtung Änderung in Vis nötig, Einstellung 5 muss entfernt werden. 
                    Skript wurde umgebaut und optimiert. Ladeleistung wird nun langsam erhöh oder verringert, um sprunghafte Wechsel
                    zu vermeiden. Mehrer Fehler behoben. Einstellung 4 sollte jetzt funktionieren.
    Version: 0.2.1  Update Function createUserStates auf Version: 1.2 (20 October 2020) von Mic (ioBroker) | Mic-M (github) 
    Version: 0.2.0  Das Laden der Batterie vom E-Auto kann jetzt auf eine einstellbaren SoC Wert in Vis begrenzt werden.
                    Wenn der aktuelle SoC Wert nicht ausgelesen werden kann, dann bei const sID_Autobatterie_SoC = '' eintragen.
                    Es wird dann vom Script diese Funktion ignoriert. 
    Version: 0.1.1  Um beim Laden vom E-Auto nicht ständig zwischen Netzbezug und Einspeisung zu wechseln
                    wurde die Trägheitsreserve auf 1000 W erhöht.
    Version: 0.1.0  Script zum steuern der Wallbox easy connect mit Mode 3-Ladekabel (3-phasig) 
                    fest angeschlagen mit Ladestecker Typ 2 von E3DC. Die Wallbox muss über Modbus 
                    verbunden sein.
******************************************************************************************/
//++++++++++++++++++++++++++++++++++  USER ANPASSUNGEN ++++++++++++++++++++++++++++++++++
const MinLadestromAuto_A = 6                // minimaler Ladestrom in A der das Fahrzeug benötigt um zu Laden. (Darf nicht unterschritten werden)
const MinLadestromStart_A = 8               // minimaler Ladestrom in A. Ab diesem Wert startet das Laden vom E-Auto
const MaxLadestrom_A = 16                   // maximaler Ladestrom in A
const MaxEntladeLeistungBatterie_W = 9000   // maximale entlade Leistung der E3DC Speicherbatterie in W.
const Haltezeit1 = 60                        // Haltezeit Einstellung 1 in min. Wenn PV-Leistung nicht mehr ausreicht wird diese Zeit weiter geladen bis das Laden pausiert.
const Haltezeit2 = 60                       // Haltezeit Einstellung 2 in min. Wenn PV-Leistung nicht mehr ausreicht wird diese Zeit weiter geladen bis das Laden pausiert.
const Haltezeit4 = 30                       // Haltezeit Einstellung 4 in min. Wenn PV-Leistung nicht mehr ausreicht wird diese Zeit weiter geladen bis das Laden pausiert.
let NettoStrompreis = 0.201                 // Strompreis für Berechnung
const Schluesselschalter_Wallbox1_1 = 1     // Welcher Lademodus soll bei Schlüsselstellung 1 angewählt werden.
const Schluesselschalter_Wallbox1_0 = 3     // Welcher Lademodus soll bei Schlüsselstellung 0 angewählt werden.
//**************************** Modul Modbus.0 E3DC Hauskraftwerk *****************************
const sID_PV_Leistung = 'modbus.0.holdingRegisters.40068_PV_Leistung';                		// Pfad State Modul ModBus 40068_PV_Leistung
const sID_Eigenverbrauch = 'modbus.0.holdingRegisters.40072_Hausverbrauch_Leistung';             
const sID_Netz_Leistung = 'modbus.0.holdingRegisters.40074_Netz_Leistung';                  // Pfad State Modul ModBus 40074_Netz_Leistung            
const sID_Batterie_Leistung = 'modbus.0.holdingRegisters.40070_Batterie_Leistung';			// Pfad State Modul ModBus 40070_Batterie_Leistung
const sID_Batterie_SoC = 'modbus.0.holdingRegisters.40083_Batterie_SOC';                    // Pfad State Modul ModBus 40083_Batterie_SOC

//**************************** Modul Modbus.1 E3DC Wallbox_1 ******************************
const sID_WallboxLadeLeistung_1 = 'modbus.1.inputRegisters.120_Leistung_aktuell';           // Pfad State Modul ModBus 120_Leistung_aktuell
const sID_Ladevorgang_Pause_1 = 'modbus.1.coils.468_Ladevorgang_pausieren';                 // Pfad State Modul ModBus Ladevorgang pausieren
const sID_Schluesselschalter_Wallbox_1 = 'modbus.1.discreteInputs.201_Eingang_EN';          // Pfad State Modul ModBus 201_Eingang_EN
const sID_Ladestrom_Wallbox_1 = 'modbus.1.holdingRegisters.528_Vorgabe_Ladestrom';          // Pfad State Modul ModBus 528_Vorgabe_Ladestrom
const sID_Gesamtzaehler_Verbrauch_kWh_1 = 'modbus.1.inputRegisters.128_total_kwh';          // Pfad State Modul ModBus 128_total_kwh
const sID_Ladestatus_1 = 'modbus.1.inputRegisters.100_status';                              // Pfad State Modul ModBus 100_status

//**************************** Adapter BMW ******************************
const sID_Autobatterie_SoC ='bmw.0.WBxxxxxxxxxxxxxxx.status.chargingLevelHv';            // Pfad State Aktueller SoC Batterie E-Auto.Wenn nicht vorhanden dann '' eintragen

//********************* Einstellungen Instanz Script E3DC_Wallbox ***********************
let instanz = '0_userdata.0.';
// Pfad innerhalb der Instanz
let PfadEbene1 = 'E3DC_Wallbox.';
let PfadEbene2 = ['Parameter.', 'Allgemein.', 'Stromverbrauch.'];
const LogAusgabe = false;                           // Zusätzliche LOG Ausgaben 
const DebugAusgabe = false;                        // Debug Ausgabe im LOG zur Fehlersuche

//---------------------------------------------------------------------------------------
//+++++++++++++++++++++++++++++++++++ ENDE USER ANPASSUNGEN +++++++++++++++++++++++++++++
//---------------------------------------------------------------------------------------

//************************************* Variablen **************************************/
const sID_Lademodus_Wallbox = instanz + PfadEbene1 + PfadEbene2[0] + 'Lademodus_Wallbox';                
const sID_WallboxLeistungAktuell = instanz + PfadEbene1 + PfadEbene2[1] + 'WallboxLeistungAktuell';
const sID_WallboxSolarLeistungAktuell = instanz + PfadEbene1 + PfadEbene2[1] + 'WallboxSolarleistung';
const sID_WallboxNetzLeistungAktuell = instanz + PfadEbene1 + PfadEbene2[1] + 'WallboxNetzleistung';
const sID_WallboxBatterieLeistungAktuell = instanz + PfadEbene1 + PfadEbene2[1] + 'WallboxBatterieleistung';
const sID_HausverbrauchAktuell = instanz + PfadEbene1 + PfadEbene2[1] + 'Hausverbrauch';
const sID_ZaehlerstandTagAlt = instanz + PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandTagAlt';
const sID_ZaehlerstandMonatAlt = instanz + PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandMonatAlt';
const sID_ZaehlerstandJahrAlt = instanz + PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandJahrAlt';
const sID_Json = instanz + PfadEbene1 + PfadEbene2[2] + 'HistoryJSON';
const sID_Automatik = instanz + PfadEbene1 + PfadEbene2[0] + 'Automatik_Wallbox';
const sID_AutoLadenBis_SoC = instanz + PfadEbene1 + PfadEbene2[1] + 'AutoLadenBis_SoC';
const sID_min_SoC_Batterie_E3DC = instanz + PfadEbene1 + PfadEbene2[1] + 'MinBatterieSoC';

let timerLadestopp;
let HaltezeitLaden = false;
let HaltezeitLaden1 = false,HaltezeitLaden2 = false,HaltezeitLaden4 = false;
let FahrzeugAngesteckt = false;
let Automatik = false;
let Autobatterie_SoC = 0;
let AutoLadenBis_SoC = 100;
let Lademodus,MinBatterieSoC;
let iAutoLadestrom_A=6;
/************************************** benötigten STATE anlegen ***********************/
let statesToCreate = [
[PfadEbene1 + PfadEbene2[1] + 'WallboxLeistungAktuell', {'def':0, 'name':'Wallbox Ladeleistung' , 'type':'number', 'role':'value', 'unit':'W'}],
[PfadEbene1 + PfadEbene2[1] + 'WallboxNetzleistung', {'def':0, 'name':'Wallbox Ladeleistung Netzbezug' , 'type':'number', 'role':'value', 'unit':'W'}],
[PfadEbene1 + PfadEbene2[1] + 'WallboxSolarleistung', {'def':0, 'name':'Wallbox Ladeleistung PV' , 'type':'number', 'role':'value', 'unit':'W'}],
[PfadEbene1 + PfadEbene2[1] + 'WallboxBatterieleistung', {'def':0, 'name':'Wallbox Ladeleistung Batterie' , 'type':'number', 'role':'value', 'unit':'W'}],
[PfadEbene1 + PfadEbene2[1] + 'Hausverbrauch', {'def':0, 'name':'Eigenverbrauch ohne Wallbox' , 'type':'number', 'role':'value', 'unit':'W'}],
[PfadEbene1 + PfadEbene2[1] + 'UhrzeitLadeende', {'def':'0', 'name':'Ladezeit' , 'type':'string', 'role':'value'}],
[PfadEbene1 + PfadEbene2[0] + 'Lademodus_Wallbox', {'def':1, 'name':'Lademodus 1= Übersch.Prio. Batterie 2= Übersch.Prio. Wallbox 3= max. Ladeleistung Wallbox' , 'type':'number', 'role':'value'}],
[PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', {'def':'', 'name':'Ladestatus nach IEC 61851-1' , 'type':'string'}],
[PfadEbene1 + PfadEbene2[0] + 'Automatik_Wallbox', {'def':false, 'name':'Bei true wird automatisch nach angewähltem Lademodus geladen' , 'type':'boolean', 'role':'State', 'desc':'Anwahl Automatik '}],
[PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandMonatAlt', {'def':0, 'name':'Letzter Zählerstand Monat' , 'type':'number', 'role':'value'}],
[PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandJahrAlt', {'def':0, 'name':'Letzter Zählerstand Jahr' , 'type':'number', 'role':'value'}],
[PfadEbene1 + PfadEbene2[2] + 'ZaehlerstandTagAlt', {'def':0, 'name':'Letzter Zählerstand Tag' , 'type':'number', 'role':'value'}],
[PfadEbene1 + PfadEbene2[2] + 'HistoryJSON', {'def':'[]', 'name':'JSON für materialdesign json chart' ,'type':'string'}],
[PfadEbene1 + PfadEbene2[1] + 'MinBatterieSoC', {'def':100, 'name':'SoC Wert bis zu dem die Batterie E3DC entladen werden darf' , 'type':'number', 'role':'value', 'unit':'%'}]
];
for (let i = 1; i <= 31; i++) {
	let n = zeroPad(i,2);
    let statePV_LeistungTag = [PfadEbene1 + PfadEbene2[2] + 'Verbrauch_E-Auto_kWh_Tag' +n, {'def':0, 'name':'PV-Leistung Tag'+n ,'type':'number','role':'value', 'unit':'kWh'}]
    statesToCreate.push(statePV_LeistungTag)
}
// State nur anlegen wenn unter sID_Autobatterie_SoC ein gültiger Pfad eingetragen wurde
if (existsState(sID_Autobatterie_SoC)){
    let stateAutoLadenBis_Soc = [PfadEbene1 + PfadEbene2[1] + 'AutoLadenBis_SoC', {'def':100, 'name':'SoC Wert E-Auto bis zu dem geladen werden soll' , 'type':'number', 'role':'value', 'unit':'%'}]
    statesToCreate.push(stateAutoLadenBis_Soc)
}

createUserStates(instanz, false, statesToCreate, function(){
    log('Jetzt sind alle States abgearbeitet');
    /* ab hier wird Code erst nach Erstellung der State ausgeführt */
    // Prüfen ob beim Scriptstart das E-Auto bereits angesteckt ist
    Lademodus = getState(sID_Lademodus_Wallbox).val;
    MinBatterieSoC = getState(sID_min_SoC_Batterie_E3DC).val;
    if (getState(sID_Ladestatus_1).val === 67 || getState(sID_Ladestatus_1).val === 66) {FahrzeugAngesteckt = true;}
    if (getState(sID_Automatik).val === true) {Automatik = true;}
    if (existsState(sID_Autobatterie_SoC)){
        Autobatterie_SoC = getState(sID_Autobatterie_SoC).val;
        AutoLadenBis_SoC = getState(sID_AutoLadenBis_SoC).val;
    }

});

//---------------------------------------------------------------------------------------
//+++++++++++++++++++++++++++++++++++++ Funktionen +++++++++++++++++++++++++++++++++++++
//---------------------------------------------------------------------------------------

function main()
{
    switch (Lademodus) {
    case 0:
        // E-Auto nicht laden
        setState(sID_Ladevorgang_Pause_1,true);
        break;
    case 1:
        // Lademodus 1= Nur Überschuss Laden mit Prio. Batterie möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
        Lademodus1();
        break;
    case 2:
        // Lademodus 2= Nur Überschuss Laden mit Prio. Wallbox möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
        Lademodus2();
        break;
    case 3:
        // E-Auto mit max. Ladestrom laden. Batterie und Netzbezug werden ignoriert
        setState(sID_Ladestrom_Wallbox_1,MaxLadestrom_A);
        setState(sID_Ladevorgang_Pause_1,false);        
        break;
    case 4:
        // Lademodus 4= Laden über Batterie E3DC ohne Netzbezug bis zu einem eingestellten SoC Wert der Batterie E3DC
        Lademodus4();
        break;
   default:
        setState(sID_Ladestrom_Wallbox_1,MinLadestromAuto_A);
        setState(sID_Ladevorgang_Pause_1,true);        
        log('unbekannter Lademodus angewählt',"warn");
    }


}

// Lademodus 1= Nur Überschuss Laden mit Prio. Batterie möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
function Lademodus1(){
    let BatterieLeistung_W = getState(sID_Batterie_Leistung).val; 
    let PV_Leistung_W = getState(sID_PV_Leistung).val;
    let Hausverbrauch_W = getState(sID_HausverbrauchAktuell).val; //Ladeleistung Wallbox bereits abgezogen
    let AutoLadeleistung_W= 0;
    let AutoLadestrom_A = 0;
    
    // Prüfen ob Batterie E3DC gerade geladen wird, ansonsten ist AutoLadeleistung_W = 0
    if (BatterieLeistung_W >= 0){
        AutoLadeleistung_W = PV_Leistung_W-Hausverbrauch_W-BatterieLeistung_W-1000;   //1000 W Trägheitsreserve als Abstand
    }else{
        AutoLadeleistung_W = 0
    }
        
    //AutoLadeleistung_W in AutoLadestrom_A umrechnen.
    AutoLadestrom_A = round(AutoLadeleistung_W/230/3,2)
    
    if (DebugAusgabe){log('Berechneter Auto Ladestrom in Ampere = '+ AutoLadestrom_A);}    
    // Wenn AutoLadestrom_A höher ist als MaxLadestrom_A, dann auf max. Ladestrom begrenzen
    if (AutoLadestrom_A > MaxLadestrom_A){ AutoLadestrom_A = MaxLadestrom_A;}
    
    // Prüfen ob mögliche AutoLadestrom_A höher als MinLadestromStart_A, wenn ja Haltezeit starten
    if (AutoLadestrom_A > MinLadestromStart_A){
        HaltezeitLaden1 = true
        if (!timerLadestopp) {timerLadestopp = setTimeout(function () {timerLadestopp = null; (HaltezeitLaden1 = false)}, Haltezeit1*60000);}
        setState(sID_Ladevorgang_Pause_1,false);
    }else{
        if (HaltezeitLaden1) {
            AutoLadestrom_A = MinLadestromAuto_A;    
        }else{
            AutoLadestrom_A = MinLadestromAuto_A;
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    
    // Wenn die Autobatterie bis zum eingestellten SoC geladen ist soll das Laden abgebrochen werden
    if (existsState(sID_Autobatterie_SoC)){
        if (Autobatterie_SoC >= AutoLadenBis_SoC ){
            AutoLadestrom_A = MinLadestromAuto_A;
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    // Vorgabe Ladestrom an Wallbox übermitteln
    setState(sID_Ladestrom_Wallbox_1,AutoLadestrom_A);
    if (DebugAusgabe){log('Lademodus = '+ Lademodus);}
    if (DebugAusgabe){log('Berechnete Auto Ladeleistung in Watt = '+ AutoLadeleistung_W);}
    if (DebugAusgabe){log('Haltezeit1 ist  = '+ HaltezeitLaden1);}
}

// Lademodus 2= Nur Überschuss Laden mit Prio. Wallbox möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
function Lademodus2(){
    let PV_Leistung_W = getState(sID_PV_Leistung).val;
    let Hausverbrauch_W = getState(sID_HausverbrauchAktuell).val; //Ladeleistung Wallbox bereits abgezogen
    let AutoLadeleistung_W= 0;
    let AutoLadestrom_A = 0;
    
    // AutoLadeleistung_W berechnen
    AutoLadeleistung_W = PV_Leistung_W-Hausverbrauch_W;
        
    //AutoLadeleistung_W in AutoLadestrom_A umrechnen.
    AutoLadestrom_A = round(AutoLadeleistung_W/230/3,2)
    
    if (DebugAusgabe){log('Berechneter Auto Ladestrom in Ampere = '+ AutoLadestrom_A);}    
    // Wenn AutoLadestrom_A höher ist als MaxLadestrom_A, dann auf max. Ladestrom begrenzen
    if (AutoLadestrom_A > MaxLadestrom_A){ AutoLadestrom_A = MaxLadestrom_A;}
    
    // Prüfen ob mögliche AutoLadestrom_A höher als MinLadestromStart_A, wenn ja Haltezeit starten
    if (AutoLadestrom_A > MinLadestromStart_A){
        HaltezeitLaden2 = true
        if (!timerLadestopp) {timerLadestopp = setTimeout(function () {timerLadestopp = null; (HaltezeitLaden2 = false)}, Haltezeit2*60000);}
        setState(sID_Ladevorgang_Pause_1,false);
        ++iAutoLadestrom_A
    }else{
        if (HaltezeitLaden2) {
            AutoLadestrom_A = MinLadestromAuto_A;    
            --iAutoLadestrom_A
        }else{
            AutoLadestrom_A = MinLadestromAuto_A;
            iAutoLadestrom_A = MinLadestromAuto_A;
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    if (iAutoLadestrom_A > MaxLadestrom_A){ iAutoLadestrom_A = MaxLadestrom_A;}
    if (iAutoLadestrom_A <= MinLadestromAuto_A){ iAutoLadestrom_A = MinLadestromAuto_A;}
    // Wenn die Autobatterie bis zum eingestellten SoC geladen ist soll das Laden abgebrochen werden
    if (existsState(sID_Autobatterie_SoC)){
        if (Autobatterie_SoC >= AutoLadenBis_SoC ){
            AutoLadestrom_A = MinLadestromAuto_A;
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    // Vorgabe Ladestrom an Wallbox übermitteln
    setState(sID_Ladestrom_Wallbox_1,iAutoLadestrom_A);
    if (DebugAusgabe){log('Lademodus = '+ Lademodus);}
    if (DebugAusgabe){log('Berechnete Auto Ladeleistung in Watt = '+ AutoLadeleistung_W);}
    if (DebugAusgabe){log('Haltezeit2 ist  = '+ HaltezeitLaden2);}
    if (DebugAusgabe){log('Autobatterie_SoC ist  = '+ Autobatterie_SoC);}
    if (DebugAusgabe){log('AutoLadenBis_SoC ist  = '+ AutoLadenBis_SoC);}
}

// Lademodus 4= Laden über Batterie E3DC ohne Netzbezug bis zu einem eingestellten SoC Wert der Batterie E3DC
function Lademodus4(){
    let NetzLeistung_W = getState(sID_Netz_Leistung).val;
    let PV_Leistung_W = getState(sID_PV_Leistung).val;
    let Hausverbrauch_W = getState(sID_Eigenverbrauch).val; //Ladeleistung Wallbox bereits abgezogen
    let BatterieSoC = getState(sID_Batterie_SoC).val;
    let WallboxLadeleistung = getState(sID_WallboxLadeLeistung_1).val;
    let AutoLadeleistung_W= 0;
    let AutoLadestrom_A = 0;
    
    if (WallboxLadeleistung >= 35000){WallboxLadeleistung = 0}
    
    // AutoLadeleistung_W berechnen
    if (DebugAusgabe){log('Hausverbrauch_W = '+ Hausverbrauch_W);}
    if (DebugAusgabe){log('NetzLeistung_W = '+ NetzLeistung_W);}
    if (NetzLeistung_W > 0){
        AutoLadeleistung_W = (PV_Leistung_W+MaxEntladeLeistungBatterie_W)-NetzLeistung_W-(Hausverbrauch_W-WallboxLadeleistung);
    }else{
        AutoLadeleistung_W = (PV_Leistung_W+MaxEntladeLeistungBatterie_W)-(Hausverbrauch_W-WallboxLadeleistung);
    }
    //log('Ladeleistung_W'+AutoLadeleistung_W);
    if (BatterieSoC <= MinBatterieSoC){
        AutoLadeleistung_W = 0;
        setState(sID_Ladevorgang_Pause_1,true);
    }        
    //AutoLadeleistung_W in AutoLadestrom_A umrechnen.
    AutoLadestrom_A = round(AutoLadeleistung_W/230/3,2)
    
    if (DebugAusgabe){log('Berechneter Auto Ladestrom in Ampere = '+ AutoLadestrom_A);}    
    // Wenn AutoLadestrom_A höher ist als MaxLadestrom_A, dann auf max. Ladestrom begrenzen
    if (AutoLadestrom_A > MaxLadestrom_A){ AutoLadestrom_A = MaxLadestrom_A;}
    
    // Prüfen ob mögliche AutoLadestrom_A höher als MinLadestromStart_A, wenn ja Haltezeit starten
    if (AutoLadestrom_A > MinLadestromStart_A){
        HaltezeitLaden4 = true
        if (!timerLadestopp) {timerLadestopp = setTimeout(function () {timerLadestopp = null; (HaltezeitLaden4 = false)}, Haltezeit4*60000);}
        setState(sID_Ladevorgang_Pause_1,false);
        ++iAutoLadestrom_A
    }else{
        if (HaltezeitLaden4) {
            AutoLadestrom_A = MinLadestromAuto_A;    
            --iAutoLadestrom_A
        }else{
            AutoLadestrom_A = MinLadestromAuto_A;
            iAutoLadestrom_A = MinLadestromAuto_A
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    if (iAutoLadestrom_A > MaxLadestrom_A){ iAutoLadestrom_A = MaxLadestrom_A;}
    if (iAutoLadestrom_A <= MinLadestromAuto_A){ iAutoLadestrom_A = MinLadestromAuto_A;}
    // Wenn die Autobatterie bis zum eingestellten SoC geladen ist soll das Laden abgebrochen werden
    if (existsState(sID_Autobatterie_SoC)){
        if (Autobatterie_SoC >= AutoLadenBis_SoC ){
            AutoLadestrom_A = MinLadestromAuto_A;
            setState(sID_Ladevorgang_Pause_1,true);
        }
    }
    // Vorgabe Ladestrom an Wallbox übermitteln
    setState(sID_Ladestrom_Wallbox_1,iAutoLadestrom_A);
    
    if (DebugAusgabe){log('Lademodus = '+ Lademodus);}
    if (DebugAusgabe){log('Berechnete Auto Ladeleistung in Watt = '+ AutoLadeleistung_W);}
    if (DebugAusgabe){log('Haltezeit4 ist  = '+ HaltezeitLaden4);}
}


// Funktion zum Runden auf einstellbare Anzahl Stellen nach dem Komma.
// Parameter: wert als float und dez als Int für die Anzahl der Stellen nach dem Komma
function round(wert, dez) {
    let umrechnungsfaktor = Math.pow(10,dez);
    return Math.round(wert * umrechnungsfaktor) / umrechnungsfaktor;
} 

// Autor:Mic (ioBroker) | Mic-M (github)
// Fügt Vornullen zu einer Zahl hinzu, macht also z.B. aus 7 eine "007". 
// Akzeptiert sowohl Datentyp number und string als Eingabe.
// Autor:Mic (ioBroker) | Mic-M (github)
function zeroPad(num, places) {
    let zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
} 

// Liefert das Datum von gestern
function lastDayDate(lastDay) {
    if (!lastDay) {
	    lastDay = new Date();
	}
    let out = { yyyy:'0', MM:'0', DD:'0' };
    lastDay.setDate(lastDay.getDate() - 1);
    let mm = lastDay.getMonth() + 1;
    let dd = lastDay.getDate();
    out.yyyy = lastDay.getFullYear();
    out.MM = zeroPad(mm,2);
    out.DD = zeroPad(dd,2);
    return out;
}

// Create states under 0_userdata.0 or javascript.x
// Autor:Mic (ioBroker) | Mic-M (github)
// Version: 1.2 (20 October 2020)
function createUserStates(where, force, statesToCreate, callback = undefined) {
 
    const WARN = false; // Only for 0_userdata.0: Throws warning in log, if state is already existing and force=false. Default is false, so no warning in log, if state exists.
    const DELAY = 50; // Delay in milliseconds (ms). Increase this to 100, if it is not working.

    // Validate "where"
    if (where.endsWith('.')) where = where.slice(0, -1); // Remove trailing dot
    if ( (where.match(/^((javascript\.([1-9][0-9]|[0-9]))$|0_userdata\.0$)/) == null) ) {
        log('This script does not support to create states under [' + where + ']', 'error');
        return;
    }

    // Prepare "statesToCreate" since we also allow a single state to create
    if(!Array.isArray(statesToCreate[0])) statesToCreate = [statesToCreate]; // wrap into array, if just one array and not inside an array

    // Add "where" to STATES_TO_CREATE
    for (let i = 0; i < statesToCreate.length; i++) {
        let lpPath = statesToCreate[i][0].replace(/\.*\./g, '.'); // replace all multiple dots like '..', '...' with a single '.'
        lpPath = lpPath.replace(/^((javascript\.([1-9][0-9]|[0-9])\.)|0_userdata\.0\.)/,'') // remove any javascript.x. / 0_userdata.0. from beginning
        lpPath = where + '.' + lpPath; // add where to beginning of string
        statesToCreate[i][0] = lpPath;
    }

    if (where != '0_userdata.0') {
        // Create States under javascript.x
        let numStates = statesToCreate.length;
        statesToCreate.forEach(function(loopParam) {
            //if (DebugAusgabe) log('[Debug] Now we are creating new state [' + loopParam[0] + ']');
            let loopInit = (loopParam[1]['def'] == undefined) ? null : loopParam[1]['def']; // mimic same behavior as createState if no init value is provided
            createState(loopParam[0], loopInit, force, loopParam[1], function() {
                numStates--;
                if (numStates === 0) {
                    //if (DebugAusgabe) log('[Debug] All states processed.');
                    if (typeof callback === 'function') { // execute if a function was provided to parameter callback
                        //if (DebugAusgabe) log('[Debug] Function to callback parameter was provided');
                        return callback();
                    } else {
                        return;
                    }
                }
            });
        });
    } else {
        // Create States under 0_userdata.0
        let numStates = statesToCreate.length;
        let counter = -1;
        statesToCreate.forEach(function(loopParam) {
            counter += 1;
            //if (DebugAusgabe) log ('[Debug] Currently processing following state: [' + loopParam[0] + ']');
            if( ($(loopParam[0]).length > 0) && (existsState(loopParam[0])) ) { // Workaround due to https://github.com/ioBroker/ioBroker.javascript/issues/478
                // State is existing.
                if (WARN && !force) log('State [' + loopParam[0] + '] is already existing and will no longer be created.', 'warn');
                //if (!WARN && DebugAusgabe) log('[Debug] State [' + loopParam[0] + '] is already existing. Option force (=overwrite) is set to [' + force + '].');
                if(!force) {
                    // State exists and shall not be overwritten since force=false
                    // So, we do not proceed.
                    numStates--;
                    if (numStates === 0) {
                        //if (DebugAusgabe) log('[Debug] All states successfully processed!');
                        if (typeof callback === 'function') { // execute if a function was provided to parameter callback
                            //if (DebugAusgabe) log('[Debug] An optional callback function was provided, which we are going to execute now.');
                            return callback();
                        } else {  // no callback, return anyway
                            return;
                        }
                    } else {
                        // We need to go out and continue with next element in loop.
                        return; // https://stackoverflow.com/questions/18452920/continue-in-cursor-foreach
                    }
                } // if(!force)
            }

            // State is not existing or force = true, so we are continuing to create the state through setObject().
            let obj = {};
            obj.type = 'state';
            obj.native = {};
            obj.common = loopParam[1];
            // @ts-ignore
            setObject(loopParam[0], obj, function (err) {
                if (err) {
                    log('Cannot write object for state [' + loopParam[0] + ']: ' + err);
                } else {
                    //if (DebugAusgabe) log('[Debug] Now we are creating new state [' + loopParam[0] + ']')
                    let init = null;
                    if(loopParam[1].def === undefined) {
                        if(loopParam[1].type === 'number') init = 0;
                        if(loopParam[1].type === 'boolean') init = false;
                        if(loopParam[1].type === 'string') init = '';
                    } else {
                        init = loopParam[1].def;
                    }
                    setTimeout(function() {
                        setState(loopParam[0], init, true, function() {
                            //if (DebugAusgabe) log('[Debug] setState durchgeführt: ' + loopParam[0]);
                            numStates--;
                            if (numStates === 0) {
                                //if (DebugAusgabe) log('[Debug] All states processed.');
                                if (typeof callback === 'function') { // execute if a function was provided to parameter callback
                                    //if (DebugAusgabe) log('[Debug] Function to callback parameter was provided');
                                    return callback();
                                }
                            }
                        });
                    }, DELAY + (20 * counter) );
                }
            });
        });
    }
}

//***************************************************************************************************
//********************************** Schedules und Trigger Bereich **********************************
//***************************************************************************************************

// Wird bei Änderung Lademodus in VIS aufgerufen
// Lademodus 0 = E-Auto nicht laden (Automatik aus)
// Lademodus 1 = Nur Überschuss Laden mit Prio. Batterie möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
// Lademodus 2 = Nur Überschuss Laden mit Prio. Wallbox möglichst ohne Netzbezug. (Netzbezug / Entladen Batterie ist während der Haltezeit möglich)
// Lademodus 3 = max. Ladeleistung Wallbox freigeben, Wenn PV-Leistung nicht ausreicht wird Batterie entladen und auch Netzbezug ist möglich
// Lademodus 4 = Laden über Batterie E3DC ohne Netzbezug bis zu einem eingestellten SoC Wert der Batterie E3DC
on({id: sID_Lademodus_Wallbox}, function (obj){
	Lademodus = getState(obj.id).val;
    main();
});  

// Wird bei Änderung PV_Leistung aufgerufen
// Bei Änderung PV_Leistung und E-Auto bereit zum laden und Lademodus = 1, 2 Main() aufrufen.
on({id: sID_PV_Leistung}, function (obj){
	let LademodusWallbox = getState(sID_Lademodus_Wallbox).val;
    if (FahrzeugAngesteckt == true && Automatik && (LademodusWallbox == 1 || LademodusWallbox == 2 ))
    {
        main();
    }
}); 

// Wird bei Änderung Batterie_Leistung aufgerufen
// Bei Änderung Batterie_Leistung und E-Auto bereit zum laden und Lademodus = 4, 5 Main() aufrufen.
on({id: sID_Batterie_Leistung}, function (obj){
	let LademodusWallbox = getState(sID_Lademodus_Wallbox).val;
    
    if (FahrzeugAngesteckt == true && Automatik && (LademodusWallbox == 4 || LademodusWallbox == 5 ))
    {
        main();
    }
});

// Wird bei Änderung Schluesselschalter Wallbox aufgerufen
// Anwahl Lademodus über Schlüsselschalter der Wallbox
on({id: sID_Schluesselschalter_Wallbox_1}, function (obj){
	let Schluesselschalter = getState(obj.id).val
    let Lademodus_Wallbox = 0
    if (Schluesselschalter){
        Lademodus_Wallbox = Schluesselschalter_Wallbox1_1
    }else{
        Lademodus_Wallbox = Schluesselschalter_Wallbox1_0
    }
    setState(sID_Lademodus_Wallbox,Lademodus_Wallbox);
});  

// Wird bei Änderung Automatik in VIS aufgerufen
// Anwahl Automatik über VIS
on({id: sID_Automatik}, function (obj){
	if (getState(obj.id).val){
        Automatik = true;
    }else{
        Automatik = false;
        setState(sID_Ladevorgang_Pause_1,true);
    }
});  

// Wird bei Änderung Eigenverbrauch aufgerufen
// Für Anzeige VIS Eigenverbrauch ohne Wallbox Ladeleistung berechnen
on({id: sID_Eigenverbrauch}, function (obj){
    let Eigenverbrauch_W = getState(obj.id).val
    let AutoLadeleistung = getState(sID_WallboxLadeLeistung_1).val
    let Hausverbrauch = 0;
    // Fehler abfangen das Wallbox sporadisch Leistungswerte über 35000 W übermittelt ohne das geladen wird
    if (AutoLadeleistung < 35000 && AutoLadeleistung > 0 ){
        Hausverbrauch = Eigenverbrauch_W-AutoLadeleistung;
    }else{
        Hausverbrauch = Eigenverbrauch_W
    }
    setState(sID_HausverbrauchAktuell,Hausverbrauch);
    
});

// Wird bei Änderung Wallbox Ladeleistung aufgerufen
// Ladeleistung in Netzleistung, Batterieleistung und Solarleistung aufteilen
on({id: sID_WallboxLadeLeistung_1}, function (obj){
    let AutoLadeleistung_W = getState(obj.id).val
    let AutoNetzleistung_W = 0;
    let AutoSolarleistung_W = 0;
    let AutoBatterieleistung_W = 0;
    let PV_Leistung_W = getState(sID_PV_Leistung).val;
    let BatterieLeistung_W = getState(sID_Batterie_Leistung).val;
    let NetzLeistung_W = getState(sID_Netz_Leistung).val;
    let R = 0;
    // Fehler abfangen das Wallbox sporadisch Leistungswerte über 35000 W übermittelt ohne das geladen wird
    if (AutoLadeleistung_W < 35000 && AutoLadeleistung_W >= 0 ){
        if (NetzLeistung_W > 0){
            if (NetzLeistung_W >= AutoLadeleistung_W){
                AutoNetzleistung_W = AutoLadeleistung_W;
            }else{
                AutoNetzleistung_W = NetzLeistung_W;
                R = AutoLadeleistung_W-NetzLeistung_W;
            }
        }else{
            R = AutoLadeleistung_W;
        }
        
        if (BatterieLeistung_W < 0 && R != 0){
            if (Math.abs(BatterieLeistung_W) >= R){
                AutoBatterieleistung_W = R;
                R = 0;
            }else{
                AutoBatterieleistung_W = Math.abs(BatterieLeistung_W)
                R = R - Math.abs(BatterieLeistung_W)
            }
        } 
        if (PV_Leistung_W > 0 && R != 0){
            if (PV_Leistung_W >= R){
                AutoSolarleistung_W = R;
                R = 0;
            }
        }
        setState(sID_WallboxSolarLeistungAktuell,round(AutoSolarleistung_W,0));
        setState(sID_WallboxNetzLeistungAktuell,round(AutoNetzleistung_W,0));
        setState(sID_WallboxBatterieLeistungAktuell,round(AutoBatterieleistung_W,0));
        setState(sID_WallboxLeistungAktuell,getState(obj.id).val);
    }
    
});

// Bei Änderung Gesamtzähler Wallbox Tageszähler Verbrauch für Vis aktualisieren
on({id: sID_Gesamtzaehler_Verbrauch_kWh_1, change: "ne"}, function (obj){
    let ZaehlerstandAkt = getState(sID_Gesamtzaehler_Verbrauch_kWh_1).val; 
    let ZaehlerstandTagAlt = getState(sID_ZaehlerstandTagAlt).val;
    let ZaehlerDif = ZaehlerstandAkt-ZaehlerstandTagAlt
    let DateHeute = new Date();
    setState(instanz + PfadEbene1 + PfadEbene2[2] + 'Verbrauch_E-Auto_kWh_Tag'+ zeroPad(DateHeute.getDate(),2),ZaehlerDif);
	
});

// Bei Änderung min. SoC Wert Batterie E3DC in Vis 
on({id: sID_min_SoC_Batterie_E3DC,change: "ne"}, function (obj){
        MinBatterieSoC = getState(obj.id).val;
});	


// Wenn State vorhanden ist, dann bei Änderung den Wert der Variable aktualisieren
if (existsState(sID_Autobatterie_SoC)){
    on({id: sID_Autobatterie_SoC,change: "ne"}, function (obj){
        Autobatterie_SoC = getState(obj.id).val;
    });	
}

// Wenn State vorhanden ist, dann bei Änderung den Wert der Variable aktualisieren
if (existsState(sID_AutoLadenBis_SoC)){    
    on({id: sID_AutoLadenBis_SoC,change: "ne"}, function (obj){
        AutoLadenBis_SoC = getState(obj.id).val;
    });
}

//Modbus.1 Register 100 ***************** Status nach IEC 61851-1 in Klartext"
on(sID_Ladestatus_1, function (obj) {
    let iStatus = obj.state.val;
    switch (iStatus) {
        case 65:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'Standby' );
            FahrzeugAngesteckt = false;
            break;
        case 66:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'E-Auto angesteckt' );
            FahrzeugAngesteckt = true;
            break;
        case 67:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'E-Auto wird geladen' );
            FahrzeugAngesteckt = true;
            break;
        case 68:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'Mit Belüftung' );
            break;
        case 69:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'Kein Strom' );
            break;
        case 70:
            setState(instanz + PfadEbene1 + PfadEbene2[0] + 'Ladestatus_Wallbox', 'Fehler' );
            break;
    }
    
});

// jeden Tag um 00:00 Verbrauch Tag speichern.
schedule("0 0 * * *", function() { 
	let ZaehlerstandAkt = getState(sID_Gesamtzaehler_Verbrauch_kWh_1).val; 
    let ZaehlerstandTagAlt = getState(sID_ZaehlerstandTagAlt).val;
    let ZaehlerDif = ZaehlerstandAkt-ZaehlerstandTagAlt
    let DateHeute = new Date();
    setState(instanz + PfadEbene1 + PfadEbene2[2] + 'Verbrauch_E-Auto_kWh_Tag'+ zeroPad(DateHeute.getDate(),2),ZaehlerDif);
	setState(sID_ZaehlerstandTagAlt,ZaehlerstandAkt)
    if (LogAusgabe)log('Tagesertragswert gespeichert');
});

// Monatlich Json speichern und Tageszähler auf 0 setzen. Am 1.1 Monatzähler auf 0 setzen
schedule("0 0 1 * *", function() { 
    if (existsState('javascript.0.Stromzaehler.Zaehlerstaende.StrompreisMonat')){
        NettoStrompreis = getState('javascript.0.Stromzaehler.Zaehlerstaende.StrompreisMonat').val;
    }
    let DateHeute = new Date();
    let DatumAkt = lastDayDate().DD +'.'+lastDayDate().MM+'.'+lastDayDate().yyyy
    let ZaehlerstandAkt = getState(sID_Gesamtzaehler_Verbrauch_kWh_1).val; 
    let ZaehlerstandMonatAlt = getState(sID_ZaehlerstandMonatAlt).val;
    let ZaehlerstandJahrAlt = getState(sID_ZaehlerstandJahrAlt).val;
    let StromVerbrauch_Mo = ZaehlerstandAkt - ZaehlerstandMonatAlt;
    let StromVerbrauchJahr = ZaehlerstandAkt - ZaehlerstandJahrAlt;
    let KostenMonat = (StromVerbrauch_Mo * NettoStrompreis) * 1.19;
    
    // für Json aufbereiten
    let obj = {};
    
    // 12 Spalten
    obj.Datum = DatumAkt;
    obj.StromverbrauchMo = round(StromVerbrauch_Mo,0) + ' kWh';
    obj.Strompreis = NettoStrompreis + ' €/kWh';
    obj.Kosten = round(KostenMonat,2) + ' €';
    obj.StromverbrauchJahr = round(StromVerbrauchJahr,0) + ' kWh';
    
    let arr = [];
    if(existsState(sID_Json)) arr = JSON.parse(getState(sID_Json).val);
    arr.push(obj);
    //if(arr.length > 12) arr.shift();
    if(existsState(sID_Json)) setState(sID_Json, JSON.stringify(arr), true);
    else createState(sID_Json, JSON.stringify(arr), {type: 'string'});
    
    if (toInt(lastDayDate().yyyy) != DateHeute.getFullYear()){
        setState(sID_ZaehlerstandJahrAlt,ZaehlerstandAkt); 
    }
    // Tageswert nullen.
    for (let i = 0; i <= 31; i++) {
	        let n = zeroPad(i,2);
            setState(instanz + PfadEbene1 + PfadEbene2[2] + 'Verbrauch_E-Auto_kWh_Tag' +n,0);
    }
    setState(sID_ZaehlerstandMonatAlt,ZaehlerstandAkt);
    
});