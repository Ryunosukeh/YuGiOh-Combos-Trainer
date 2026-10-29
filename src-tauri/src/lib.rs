// Reine Hülle: Fenster mit der gebauten Web-App (dist/). Regeln, Daten und Oberfläche kommen komplett aus der
// Web-App; hier gibt es bewusst keine eigene Logik.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Fehler beim Start der App");
}
