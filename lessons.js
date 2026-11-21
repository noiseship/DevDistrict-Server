export const lessons = [
  {
    "language": "SQL",
    "hint": "Звёздочка обозначает все столбцы.",
    "fact": "SELECT читает данные, а DELETE удаляет строки.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "students(id, name, age)"
  },
  {
    "language": "SQL",
    "hint": "Условие фильтрации записывают после WHERE.",
    "fact": "WHERE отбирает строки, для которых условие истинно.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "students(id, name, age)"
  },
  {
    "language": "SQL",
    "hint": "COUNT(*) считает строки.",
    "fact": "COUNT(*) учитывает все строки, даже если отдельные поля содержат NULL.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "orders(id, price)"
  },
  {
    "language": "SQL",
    "hint": "DESC — по убыванию.",
    "fact": "ASC задаёт возрастание, DESC — убывание.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "products(id, price)"
  },
  {
    "language": "SQL",
    "hint": "AVG вычисляет среднее.",
    "fact": "AVG игнорирует NULL в аргументе.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "products(id, price)"
  },
  {
    "language": "SQL",
    "hint": "После SELECT перечисляют нужные столбцы.",
    "fact": "Можно выбирать отдельные столбцы без изменения таблицы.",
    "source": "https://www.postgresql.org/docs/current/sql-select.html",
    "code": "students(id, name, age)"
  },
  {
    "language": "Python",
    "hint": "** — возведение в степень.",
    "fact": "2 в третьей степени равно 8.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "print(2 ** 3)"
  },
  {
    "language": "Python",
    "hint": "Индексация начинается с нуля.",
    "fact": "Первый элемент списка имеет индекс 0.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "items = [10, 20, 30]\nprint(items[0])"
  },
  {
    "language": "Python",
    "hint": "len возвращает количество элементов.",
    "fact": "В списке три элемента.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "print(len([4, 5, 6]))"
  },
  {
    "language": "Python",
    "hint": "Правая граница range не включается.",
    "fact": "range(3) даёт 0, 1 и 2.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "print(list(range(3)))"
  },
  {
    "language": "Python",
    "hint": "% вычисляет остаток от деления.",
    "fact": "7 = 2 × 3 + 1.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "x = 7\nprint(x % 3)"
  },
  {
    "language": "Python",
    "hint": "append добавляет элемент в конец.",
    "fact": "Списки Python изменяемые.",
    "source": "https://docs.python.org/3/tutorial/",
    "code": "a = [1, 2]\na.append(3)\nprint(a)"
  }
];
