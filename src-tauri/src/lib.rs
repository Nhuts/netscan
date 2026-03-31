mod config;
mod commands;
mod scanner;

#[cfg_attr(mobile, tauri::mobile_entrypoint)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_local_network_info,
            commands::scan_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}