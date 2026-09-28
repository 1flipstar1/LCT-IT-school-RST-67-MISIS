# Генератор фикстур для tests/xls.test.js: pip install xlwt && python make-import-biff8.py import-biff8.xls
# Фикстура BIFF8: заголовки из шаблона импорта, кириллица, числа (RK и NUMBER), дата, длинный текст
# и 400 строк — SST переходит через записи CONTINUE, поток Workbook больше 4096 байт (обычные сектора CFB).
import datetime, sys, xlwt
book = xlwt.Workbook(encoding="utf-8")
sheet = book.add_sheet("Договоры")
empty = book.add_sheet("Пусто")
header = ["Название ВУЗа", "Вендор", "ПО", "Номер договора", "Подписание лицензии", "Срок действия лицензии (год)", "Статус по передачи", "ФИО Менеджера", "Ответственные от ВУЗа", "Комментарий"]
for col, value in enumerate(header):
    sheet.write(0, col, value)
date_style = xlwt.easyxf(num_format_str="DD.MM.YYYY")
sheet.write(1, 0, "Казанский федеральный университет")
sheet.write(1, 1, "МойОфис")
sheet.write(1, 2, "МойОфис Стандартный")
sheet.write(1, 3, "Д-2026/17")
sheet.write(1, 4, datetime.date(2026, 9, 17), date_style)
sheet.write(1, 5, 3)
sheet.write(1, 6, "Передано")
sheet.write(1, 7, "Алина Воронова")
sheet.write(1, 8, "Ирина Петрова")
sheet.write(1, 9, "Длинный комментарий " + "ё" * 300)
sheet.write(2, 0, "МГТУ им. Н. Э. Баумана")
sheet.write(2, 5, 2.5)
sheet.write(2, 3, 123456789)
for row in range(3, 403):
    sheet.write(row, 0, f"Вуз № {row} — уникальная строка для SST {'x' * (row % 50)}")
    sheet.write(row, 5, row)
book.save(sys.argv[1])

# Маленькая книга (поток Workbook < 4096 байт) — хранится в мини-потоке CFB.
small = xlwt.Workbook(encoding="utf-8")
tiny = small.add_sheet("Лист1")
tiny.write(0, 0, "Название ВУЗа")
tiny.write(1, 0, "НИУ ВШЭ")
tiny.write(1, 1, 42)
small.save(sys.argv[1].replace(".xls", "-small.xls"))
