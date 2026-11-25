import Foundation
import SwiftUI

/// 앱의 모든 데이터를 관리하고 기기에 JSON 파일로 저장합니다.
final class InventoryStore: ObservableObject {
    @Published private(set) var items: [InventoryItem] = []
    @Published private(set) var entries: [StockEntry] = []

    private struct SaveFile: Codable {
        var items: [InventoryItem]
        var entries: [StockEntry]
    }

    private let fileURL: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("inventory.json")
    }()

    init() {
        load()
        if items.isEmpty { seed() }
    }

    // MARK: - 조회

    /// 카테고리 목록 (품목 순서대로)
    var categories: [String] {
        var seen = Set<String>()
        return items.sorted { $0.sortOrder < $1.sortOrder }
            .map(\.category)
            .filter { seen.insert($0).inserted }
    }

    func items(in category: String) -> [InventoryItem] {
        items.filter { $0.category == category }.sorted { $0.sortOrder < $1.sortOrder }
    }

    func item(id: UUID) -> InventoryItem? {
        items.first { $0.id == id }
    }

    /// 해당 날짜 기준 재고 (그 날짜 이전 가장 최근 기록)
    func stock(for itemID: UUID, on date: Date) -> StockEntry? {
        let day = date.startOfDay
        return entries
            .filter { $0.itemID == itemID && $0.date <= day }
            .max { $0.date < $1.date }
    }

    /// 해당 날짜에 직접 기록한 값이 있는지
    func entry(for itemID: UUID, exactlyOn date: Date) -> StockEntry? {
        let day = date.startOfDay
        return entries.first { $0.itemID == itemID && $0.date == day }
    }

    /// 해당 날짜 바로 전의 재고 (변경 내역 비교용)
    func previousStock(for itemID: UUID, before date: Date) -> StockEntry? {
        let day = date.startOfDay
        return entries
            .filter { $0.itemID == itemID && $0.date < day }
            .max { $0.date < $1.date }
    }

    func history(for itemID: UUID) -> [StockEntry] {
        entries.filter { $0.itemID == itemID }.sorted { $0.date > $1.date }
    }

    /// 기록이 있는 날짜들 (최신순)
    var recordedDays: [Date] {
        Array(Set(entries.map(\.date))).sorted(by: >)
    }

    func entries(on day: Date) -> [StockEntry] {
        let d = day.startOfDay
        return entries.filter { $0.date == d }
            .sorted { (item(id: $0.itemID)?.sortOrder ?? 0) < (item(id: $1.itemID)?.sortOrder ?? 0) }
    }

    // MARK: - 수정

    func setStock(itemID: UUID, date: Date, quantity: Double, shots: Int?, memo: String = "") {
        let day = date.startOfDay
        if let idx = entries.firstIndex(where: { $0.itemID == itemID && $0.date == day }) {
            entries[idx].quantity = quantity
            entries[idx].shots = shots
            entries[idx].memo = memo
            entries[idx].updatedAt = Date()
        } else {
            entries.append(StockEntry(itemID: itemID, date: day, quantity: quantity, shots: shots, memo: memo))
        }
        save()
    }

    /// 목록에서 +/- 버튼으로 빠르게 수량 조절
    func adjust(itemID: UUID, date: Date, by delta: Double) {
        let current = stock(for: itemID, on: date)
        let newQty = max(0, (current?.quantity ?? 0) + delta)
        let keepMemo = entry(for: itemID, exactlyOn: date)?.memo ?? ""
        setStock(itemID: itemID, date: date, quantity: newQty, shots: current?.shots, memo: keepMemo)
    }

    func deleteEntry(_ entry: StockEntry) {
        entries.removeAll { $0.id == entry.id }
        save()
    }

    func addItem(_ item: InventoryItem, initialQuantity: Double, initialShots: Int?, date: Date) {
        var newItem = item
        newItem.sortOrder = nextSortOrder(for: item.category)
        shiftSortOrders(after: newItem.sortOrder - 1)
        items.append(newItem)
        entries.append(StockEntry(itemID: newItem.id, date: date.startOfDay,
                                  quantity: initialQuantity, shots: initialShots, memo: "신규 등록"))
        save()
    }

    func updateItem(_ item: InventoryItem) {
        guard let idx = items.firstIndex(where: { $0.id == item.id }) else { return }
        var updated = item
        if items[idx].category != item.category {
            updated.sortOrder = nextSortOrder(for: item.category)
            shiftSortOrders(after: updated.sortOrder - 1)
        }
        items[idx] = updated
        save()
    }

    func deleteItem(id: UUID) {
        items.removeAll { $0.id == id }
        entries.removeAll { $0.itemID == id }
        save()
    }

    // MARK: - 내보내기

    /// 선택한 날짜 기준 재고표를 CSV 파일로 만듭니다 (엑셀에서 열 수 있음)
    func exportCSV(on date: Date) -> URL {
        var lines = ["\u{FEFF}카테고리,품목,수량,단위,남은샷,메모"]
        for cat in categories {
            for item in items(in: cat) {
                let s = stock(for: item.id, on: date)
                let shots = item.tracksShots ? String(s?.shots ?? 0) : ""
                let cols = [cat, item.name, (s?.quantity ?? 0).qtyString, item.unit, shots, item.note]
                lines.append(cols.map(csvEscape).joined(separator: ","))
            }
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("병원재고_\(date.isoDayString).csv")
        try? lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    private func csvEscape(_ s: String) -> String {
        if s.contains(",") || s.contains("\"") || s.contains("\n") {
            return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return s
    }

    // MARK: - 내부

    private func nextSortOrder(for category: String) -> Int {
        if let last = items.filter({ $0.category == category }).map(\.sortOrder).max() {
            return last + 1
        }
        return (items.map(\.sortOrder).max() ?? -1) + 1
    }

    private func shiftSortOrders(after order: Int) {
        for i in items.indices where items[i].sortOrder > order {
            items[i].sortOrder += 1
        }
    }

    private func seed() {
        let today = Date().startOfDay
        for (i, row) in SeedData.rows.enumerated() {
            let item = InventoryItem(name: row.name, category: row.category, unit: row.unit,
                                     tracksShots: row.shots != nil, note: row.note, sortOrder: i)
            items.append(item)
            entries.append(StockEntry(itemID: item.id, date: today, quantity: row.qty, shots: row.shots))
        }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let file = try? decoder.decode(SaveFile.self, from: data) {
            items = file.items
            entries = file.entries
        }
    }

    private func save() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted]
        if let data = try? encoder.encode(SaveFile(items: items, entries: entries)) {
            try? data.write(to: fileURL, options: [.atomic])
        }
    }
}
