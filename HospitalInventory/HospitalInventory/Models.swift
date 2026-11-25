import Foundation

/// 재고 품목 (예: 리쥬란, 보툴렉스 200)
struct InventoryItem: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var name: String
    var category: String
    var unit: String
    /// 울쎄라 팁처럼 "남은 샷 수"를 따로 관리하는 품목인지
    var tracksShots: Bool = false
    /// 모델명 등 메모
    var note: String = ""
    var sortOrder: Int = 0
}

/// 특정 날짜에 기록한 재고량. 기록이 없는 날은 가장 최근 기록을 그대로 이어서 사용합니다.
struct StockEntry: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var itemID: UUID
    /// 하루 단위 (그 날의 00:00)
    var date: Date
    var quantity: Double
    var shots: Int?
    var memo: String = ""
    var updatedAt: Date = Date()
}

enum Units {
    static let presets = ["개", "샷", "팩", "바이알", "앰플", "박스", "병", "cc", "ml"]
}

extension Double {
    /// 3 → "3", 33.6 → "33.6"
    var qtyString: String {
        if self == rounded() { return String(Int(self)) }
        let f = NumberFormatter()
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 2
        return f.string(from: NSNumber(value: self)) ?? String(self)
    }
}

extension Date {
    var startOfDay: Date { Calendar.current.startOfDay(for: self) }

    var koreanDayString: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "yyyy년 M월 d일 (E)"
        return f.string(from: self)
    }

    var isoDayString: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: self)
    }
}

/// 처음 실행할 때 들어가는 기본 품목 목록
enum SeedData {
    struct Row {
        let name: String
        let category: String
        let unit: String
        let qty: Double
        var shots: Int? = nil
        var note: String = ""
    }

    static let rows: [Row] = [
        Row(name: "울쎄라팁 주황 (1.0-1.5)", category: "울쎄라", unit: "개", qty: 1, shots: 300),
        Row(name: "울쎄라팁 초록 (7-3.0)", category: "울쎄라", unit: "개", qty: 1, shots: 198),
        Row(name: "울쎄라팁 파랑 (4-4.5)", category: "울쎄라", unit: "개", qty: 1, shots: 0),

        Row(name: "써마지 600샷", category: "써마지", unit: "개", qty: 0),
        Row(name: "써마지 300샷", category: "써마지", unit: "개", qty: 0),

        Row(name: "덴서티 클래식", category: "덴서티", unit: "개", qty: 0),
        Row(name: "덴서티 알파", category: "덴서티", unit: "개", qty: 0),

        Row(name: "리쥬란", category: "리쥬란", unit: "개", qty: 21),
        Row(name: "리쥬란 HB", category: "리쥬란", unit: "개", qty: 4),
        Row(name: "리쥬란 i", category: "리쥬란", unit: "개", qty: 5),

        Row(name: "뉴라미스 클래식", category: "필러", unit: "개", qty: 3),
        Row(name: "뉴라미스 딥", category: "필러", unit: "개", qty: 6),
        Row(name: "레스틸렌", category: "필러", unit: "개", qty: 3),
        Row(name: "레스틸렌 키스", category: "필러", unit: "개", qty: 5),
        Row(name: "레스틸렌 리프트", category: "필러", unit: "개", qty: 2),
        Row(name: "쥬비덤 볼루마", category: "필러", unit: "개", qty: 2),
        Row(name: "쥬비덤 볼리프트", category: "필러", unit: "개", qty: 3),
        Row(name: "바이리즌", category: "필러", unit: "개", qty: 4),

        Row(name: "보툴렉스 50", category: "보톡스", unit: "개", qty: 4),
        Row(name: "보툴렉스 100", category: "보톡스", unit: "개", qty: 0),
        Row(name: "보툴렉스 150", category: "보톡스", unit: "개", qty: 0),
        Row(name: "보툴렉스 200", category: "보톡스", unit: "개", qty: 10),
        Row(name: "엘러간 50", category: "보톡스", unit: "개", qty: 1),

        Row(name: "쥬베룩 스킨", category: "쥬베룩", unit: "개", qty: 6),
        Row(name: "쥬베룩 볼륨", category: "쥬베룩", unit: "개", qty: 7),

        Row(name: "줄기세포 30", category: "줄기세포", unit: "개", qty: 6),
        Row(name: "줄기세포 60", category: "줄기세포", unit: "개", qty: 5),
        Row(name: "줄기세포 120", category: "줄기세포", unit: "개", qty: 2),
        Row(name: "줄기세포 240", category: "줄기세포", unit: "개", qty: 1),

        Row(name: "민트 파인 (x4)", category: "실·보형물", unit: "팩", qty: 24),
        Row(name: "엘라텐스 페이스", category: "실·보형물", unit: "개", qty: 0, note: "모델명 18085"),
        Row(name: "엘라텐스 넥", category: "실·보형물", unit: "개", qty: 3, note: "모델명 17085"),
        Row(name: "기증늑", category: "실·보형물", unit: "개", qty: 1),
        Row(name: "메가덤", category: "실·보형물", unit: "개", qty: 7),

        Row(name: "포폴", category: "약품", unit: "바이알", qty: 33),
        Row(name: "미다", category: "약품", unit: "앰플", qty: 33.6),
        Row(name: "케타", category: "약품", unit: "앰플", qty: 28.6),
    ]
}
