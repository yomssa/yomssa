import SwiftUI

/// 날짜별로 어떤 품목이 어떻게 바뀌었는지 보여주는 화면
struct HistoryView: View {
    @EnvironmentObject private var store: InventoryStore

    var body: some View {
        NavigationStack {
            List {
                if store.recordedDays.isEmpty {
                    Text("아직 기록이 없습니다").foregroundStyle(.secondary)
                }
                ForEach(store.recordedDays, id: \.self) { day in
                    NavigationLink {
                        DayDetailView(day: day)
                    } label: {
                        HStack {
                            Text(day.koreanDayString)
                            Spacer()
                            Text("\(store.entries(on: day).count)건")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("날짜별 기록")
        }
    }
}

struct DayDetailView: View {
    @EnvironmentObject private var store: InventoryStore
    let day: Date

    var body: some View {
        List {
            ForEach(store.entries(on: day)) { entry in
                if let item = store.item(id: entry.itemID) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name).font(.headline)
                        HistoryRow(entry: entry, item: item)
                    }
                }
            }
            .onDelete { offsets in
                let list = store.entries(on: day)
                for i in offsets { store.deleteEntry(list[i]) }
            }
        }
        .navigationTitle(day.koreanDayString)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ShareLink(item: store.exportCSV(on: day)) {
                Image(systemName: "square.and.arrow.up")
            }
        }
    }
}
