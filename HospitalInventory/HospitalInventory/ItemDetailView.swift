import SwiftUI

/// 품목 하나의 재고를 날짜별로 수정하는 화면
struct ItemDetailView: View {
    @EnvironmentObject private var store: InventoryStore
    @Environment(\.dismiss) private var dismiss
    let itemID: UUID
    @Binding var selectedDate: Date

    @State private var quantityText = ""
    @State private var shotsText = ""
    @State private var memo = ""
    @State private var showingEdit = false
    @State private var confirmDelete = false
    @State private var savedMessage = false
    @FocusState private var focused: Bool

    var body: some View {
        if let item = store.item(id: itemID) {
            form(item)
        } else {
            ContentUnavailableView("삭제된 품목입니다", systemImage: "trash")
        }
    }

    private func form(_ item: InventoryItem) -> some View {
        Form {
            Section {
                DatePicker("날짜", selection: $selectedDate, displayedComponents: .date)
            } footer: {
                if store.entry(for: itemID, exactlyOn: selectedDate) == nil,
                   let prev = store.stock(for: itemID, on: selectedDate) {
                    Text("이 날짜엔 기록이 없어 \(prev.date.koreanDayString) 기록을 보여주고 있어요.")
                }
            }

            Section("재고 수량") {
                HStack {
                    TextField("수량", text: $quantityText)
                        .keyboardType(.decimalPad)
                        .focused($focused)
                        .font(.title2.monospacedDigit())
                    Text(item.unit).foregroundStyle(.secondary)
                }
                HStack {
                    quickButton("-1", -1)
                    quickButton("+1", 1)
                    quickButton("+5", 5)
                    quickButton("+10", 10)
                }
                if item.tracksShots {
                    HStack {
                        Text("남은 샷")
                        TextField("0", text: $shotsText)
                            .keyboardType(.numberPad)
                            .focused($focused)
                            .multilineTextAlignment(.trailing)
                        Text("샷").foregroundStyle(.secondary)
                    }
                }
                TextField("메모 (예: 입고, 시술 사용)", text: $memo)
                    .focused($focused)
            }

            Section {
                Button {
                    save(item)
                } label: {
                    Text(savedMessage ? "저장됨 ✓" : "\(selectedDate.koreanDayString) 재고로 저장")
                        .frame(maxWidth: .infinity)
                        .fontWeight(.semibold)
                }
                .disabled(Double(quantityText.replacingOccurrences(of: ",", with: ".")) == nil)
            }

            Section("변경 기록") {
                let history = store.history(for: itemID)
                if history.isEmpty {
                    Text("기록 없음").foregroundStyle(.secondary)
                }
                ForEach(history) { entry in
                    Button {
                        selectedDate = entry.date
                    } label: {
                        HistoryRow(entry: entry, item: item)
                    }
                    .tint(.primary)
                }
                .onDelete { offsets in
                    for i in offsets { store.deleteEntry(history[i]) }
                    load()
                }
            }

            Section {
                Button("품목 정보 수정") { showingEdit = true }
                Button("품목 삭제", role: .destructive) { confirmDelete = true }
            }
        }
        .navigationTitle(item.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("완료") { focused = false }
            }
        }
        .onAppear(perform: load)
        .onChange(of: selectedDate) { load() }
        .sheet(isPresented: $showingEdit) {
            ItemFormView(mode: .edit(item))
        }
        .confirmationDialog("'\(item.name)' 품목과 모든 기록을 삭제할까요?",
                            isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("삭제", role: .destructive) {
                store.deleteItem(id: itemID)
                dismiss()
            }
        }
    }

    private func quickButton(_ title: String, _ delta: Double) -> some View {
        Button(title) {
            let current = Double(quantityText.replacingOccurrences(of: ",", with: ".")) ?? 0
            quantityText = max(0, current + delta).qtyString
        }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity)
    }

    private func load() {
        let s = store.stock(for: itemID, on: selectedDate)
        quantityText = (s?.quantity ?? 0).qtyString
        shotsText = String(s?.shots ?? 0)
        memo = store.entry(for: itemID, exactlyOn: selectedDate)?.memo ?? ""
        savedMessage = false
    }

    private func save(_ item: InventoryItem) {
        guard let qty = Double(quantityText.replacingOccurrences(of: ",", with: ".")) else { return }
        let shots = item.tracksShots ? (Int(shotsText) ?? 0) : nil
        store.setStock(itemID: itemID, date: selectedDate, quantity: max(0, qty), shots: shots, memo: memo)
        focused = false
        savedMessage = true
    }
}

struct HistoryRow: View {
    @EnvironmentObject private var store: InventoryStore
    let entry: StockEntry
    let item: InventoryItem

    var body: some View {
        let prev = store.previousStock(for: entry.itemID, before: entry.date)
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.date.koreanDayString).font(.subheadline)
                if !entry.memo.isEmpty {
                    Text(entry.memo).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 4) {
                    if let prev {
                        Text(prev.quantity.qtyString).foregroundStyle(.secondary)
                        Image(systemName: "arrow.right").font(.caption2).foregroundStyle(.secondary)
                    }
                    Text("\(entry.quantity.qtyString)\(item.unit)").fontWeight(.semibold)
                }
                .font(.subheadline.monospacedDigit())
                if item.tracksShots {
                    Text("\(entry.shots ?? 0)샷").font(.caption).foregroundStyle(.orange)
                }
            }
        }
    }
}
