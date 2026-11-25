import SwiftUI

@main
struct HospitalInventoryApp: App {
    @StateObject private var store = InventoryStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environment(\.locale, Locale(identifier: "ko_KR"))
        }
    }
}

struct ContentView: View {
    @State private var selectedDate = Date()

    var body: some View {
        TabView {
            InventoryListView(selectedDate: $selectedDate)
                .tabItem { Label("재고", systemImage: "shippingbox") }
            HistoryView()
                .tabItem { Label("날짜별 기록", systemImage: "calendar") }
        }
    }
}
