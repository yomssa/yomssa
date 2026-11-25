import SwiftUI

struct InventoryListView: View {
    @EnvironmentObject private var store: InventoryStore
    @Binding var selectedDate: Date
    @State private var searchText = ""
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DatePicker("기준 날짜", selection: $selectedDate, displayedComponents: .date)
                    if !Calendar.current.isDateInToday(selectedDate) {
                        Button("오늘로 이동") { selectedDate = Date() }
                    }
                } footer: {
                    Text("날짜를 고른 뒤 수량을 바꾸면 그 날짜의 재고로 저장됩니다. 기록이 없는 날은 직전 기록이 그대로 이어집니다.")
                }

                ForEach(store.categories, id: \.self) { category in
                    let rows = filtered(store.items(in: category))
                    if !rows.isEmpty {
                        Section(category) {
                            ForEach(rows) { item in
                                NavigationLink(value: item.id) {
                                    ItemRow(item: item, date: selectedDate)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("병원 재고")
            .searchable(text: $searchText, prompt: "품목 검색")
            .navigationDestination(for: UUID.self) { id in
                ItemDetailView(itemID: id, selectedDate: $selectedDate)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ShareLink(item: store.exportCSV(on: selectedDate)) {
                        Label("내보내기", systemImage: "square.and.arrow.up")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingAdd = true } label: {
                        Label("품목 추가", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAdd) {
                ItemFormView(mode: .add(date: selectedDate))
            }
        }
    }

    private func filtered(_ items: [InventoryItem]) -> [InventoryItem] {
        let q = searchText.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return items }
        return items.filter {
            $0.name.localizedCaseInsensitiveContains(q) ||
            $0.category.localizedCaseInsensitiveContains(q) ||
            $0.note.localizedCaseInsensitiveContains(q)
        }
    }
}

struct ItemRow: View {
    @EnvironmentObject private var store: InventoryStore
    let item: InventoryItem
    let date: Date

    var body: some View {
        let stock = store.stock(for: item.id, on: date)
        let qty = stock?.quantity ?? 0
        let editedToday = store.entry(for: item.id, exactlyOn: date) != nil

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(item.name).font(.body)
                    if editedToday {
                        Circle().fill(Color.accentColor).frame(width: 6, height: 6)
                            .accessibilityLabel("이 날짜에 수정됨")
                    }
                }
                if !item.note.isEmpty {
                    Text(item.note).font(.caption).foregroundStyle(.secondary)
                }
                if item.tracksShots {
                    let shots = stock?.shots ?? 0
                    Text("\(shots)샷 남음")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(shots == 0 ? Color.red : Color.orange)
                }
            }

            Spacer()

            Button { store.adjust(itemID: item.id, date: date, by: -1) } label: {
                Image(systemName: "minus.circle").font(.title3)
            }
            .buttonStyle(.borderless)
            .disabled(qty <= 0)

            Text("\(qty.qtyString)\(item.unit)")
                .font(.body.monospacedDigit().weight(.semibold))
                .foregroundStyle(qty <= 0 ? Color.red : Color.primary)
                .frame(minWidth: 64, alignment: .center)

            Button { store.adjust(itemID: item.id, date: date, by: 1) } label: {
                Image(systemName: "plus.circle").font(.title3)
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 2)
    }
}
