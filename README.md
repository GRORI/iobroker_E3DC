# iobroker-E3DC

<h3>E3DC-Control</h3>
Script zum steuern von E3DC-Control von Eberhard M. über iobroker VIS.
<p>https://github.com/Eba-M/E3DC-Control</p>
Mit dem Programm E3DC-Control soll erreicht werden, dass der Batteriespeicher möglichst schonend geladen wird, um die Lebensdauer zu erhöhen und ein abregeln 
beim Überschreiten der 70% Einspeisegrenze zu verhindern.
Das Script erweitert die Funktion von E3DC-Control um eine Wetterprognose, mit der 5 verschiedene Einstellungen je nach Wetter aufgerufen werden können.
<p>Weitere Informationen im iobroker Forum: https://forum.iobroker.net/topic/32976/e3dc-hauskraftwerk-steuern</p>

<h3>E3DC_Wallbox</h3>
Script zum Steuern der Wallbox easy connect mit Mode 3-Ladekabel (3-phasig) fest angeschlagen mit Ladestecker Typ 2 von E3DC. Die Wallbox muss über Modbus
verbunden sein.

<h3>Modbus</h3>
<p>Script Sammlung Modbus Adapter für E3DC.</p>
<ul>
<li>Modbus Register 40082 Aufteilung "Autarkie und Eigenverbrauch in Prozent<br>Autor: Andre Germann</li><br>
<li>Modbus Register 40002 Aufteilung "Modbus Firmware Version"<br>Autor: Andre Germann</li><br>
<li>Modbus Register 40085 "EMS-Status" Datenwort Dez. in BIT_Ausgabe für Vis umwandeln<br>Autor: ArnoD</li><br>
<li>Modbus Register 40088 "Wallbox_x_CTRL" Datenwort Dez. in BIT_Ausgabe für Vis umwandeln<br>Autor: ArnoD</li><br>
<li>E3DC dynamische Autonomiezeitberechnung V0.0.8<br>Autor: Smartboard</li><br>
<li>Bei Firmware-Updates das Datum des Updates und die alte Versionsnummer speichern<br>Autor: stevie77</li><br>
</ul>