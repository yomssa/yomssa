import SwiftUI

/// 신규 품목 추가 / 기존 품목 정보 수정
struct ItemFormView: View {
    enum Mode {
        case add(date: Date)
        case edit(InventoryItem)
    }

    @EnvironmentObject private var store: InventoryStore
    @Environment(\.dismiss) private var dismiss
    let mode: Mode

    @State private var name = ""
    @State private var category = ""
    @State private var newCategory = ""
    @State private var unit = "개"
    @State private var customUnit = ""
    @State private var tracksShots = false
    @State private var note = ""
    @State private var quantityText = "0"
    @State private var shotsText = "0"
    @State private var date = Date()
    @State private var loaded = false

    private static let newCategoryTag = "__new__"
    private static let customUnitTag = "__custom__"

    private var isEdit: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var resolvedCategory: String {
        (category == Self.newCategoryTag ? newCategory : category).trimmingCharacters(in: .whitespaces)
    }

    private var resolvedUnit: String {
        (unit == Self.customUnitTag ? customUnit : unit).trimmingCharacters(in: .whitespaces)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !resolvedCategory.isEmpty && !resolvedUnit.isEmpty &&
        (isEdit || Double(quantityText.replacingOccurrences(of: ",", with: ".")) != nil)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("품목") {
                    TextField("품목 이름 (예: 리쥬란 HB)", text: $name)
                    TextField("메모 / 모델명 (선택)", text: $note)
                }

                Section("분류") {
                    Picker("카테고리", selection: $category) {
                        ForEach(store.categories, id: \.self) { Text($0).tag($0) }
                        Text("새 카테고리…").tag(Self.newCategoryTag)
                    }
                    if category == Self.newCategoryTag {
                        TextField("새 카테고리 이름", text: $newCategory)
                    }
                    Picker("단위", selection: $unit) {
                        ForEach(Units.presets, id: \.self) { Text($0).tag($0) }
                        Text("직접 입력…").tag(Self.customUnitTag)
                    }
                    if unit == Self.customUnitTag {
                        TextField("단위", text: $customUnit)
                    }
                    Toggle("남은 샷 수 관리 (울쎄라 팁 등)", isOn: $tracksShots)
                }

                if !isEdit {
                    Section("현재 재고") {
                        DatePicker("등록 날짜", selection: $date, displayedComponents: .date)
                        HStack {
                            Text("수량")
                            TextField("0", text: $quantityText)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                            Text(resolvedUnit).foregroundStyle(.secondary)
                        }
                        if tracksShots {
                            HStack {
                                Text("남은 샷")
                                TextField("0", text: $shotsText)
                                    .keyboardType(.numberPad)
                                    .multilineTextAlignment(.trailing)
                                Text("샷").foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle(isEdit ? "품목 수정" : "새 품목 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEdit ? "저장" : "추가") { save() }
                        .disabled(!canSave)
                }
            }
            .onAppear(perform: loadOnce)
        }
    }

    private func loadOnce() {
        guard !loaded else { return }
        loaded = true
        switch mode {
        case .add(let d):
            date = d
            category = store.categories.first ?? Self.newCategoryTag
        case .edit(let item):
            name = item.name
            category = item.category
            note = item.note
            tracksShots = item.tracksShots
            if Units.presets.contains(item.unit) {
                unit = item.unit
            } else {
                unit = Self.customUnitTag
                customUnit = item.unit
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedNote = note.trimmingCharacters(in: .whitespaces)
        switch mode {
        case .add:
            let item = InventoryItem(name: trimmedName, category: resolvedCategory, unit: resolvedUnit,
                                     tracksShots: tracksShots, note: trimmedNote)
            let qty = Double(quantityText.replacingOccurrences(of: ",", with: ".")) ?? 0
            store.addItem(item, initialQuantity: max(0, qty),
                          initialShots: tracksShots ? (Int(shotsText) ?? 0) : nil, date: date)
        case .edit(let original):
            var item = original
            item.name = trimmedName
            item.category = resolvedCategory
            item.unit = resolvedUnit
            item.tracksShots = tracksShots
            item.note = trimmedNote
            store.updateItem(item)
        }
        dismiss()
    }
}
