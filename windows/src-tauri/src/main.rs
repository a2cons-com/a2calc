// A2 Calc for Windows: one window showing the bundled web build in the
// system's WebView2. Links that leave the app open in the default browser.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // A calculator-sized window: it can grow a little, never maximize.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("A2 Calc")
                .inner_size(440.0, 860.0)
                .min_inner_size(380.0, 700.0)
                .max_inner_size(760.0, 1100.0)
                .resizable(true)
                .maximizable(false)
                .on_navigation(|url| {
                    let inside = url.scheme() == "tauri"
                        || url.host_str() == Some("tauri.localhost")
                        || url.host_str() == Some("localhost");
                    if !inside {
                        let _ = open::that(url.as_str());
                    }
                    inside
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("A2 Calc could not start");
}
