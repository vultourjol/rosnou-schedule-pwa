class ScheduleParser {
    constructor() {
        this.schedule = {};
        this.lessonTypes = {
            'Л': 'Лекция',
            'ПЗ': 'Практическое занятие',
            'С': 'Семинар',
            'ВЛ': 'Видео-лекция',
            'Лаб': 'Лабораторная',
            'ЗАЧ': 'Зачёт'
        };
    }

    parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    
                    this.schedule = this.processScheduleData(json);
                    this.saveToLocalStorage();
                    resolve(this.schedule);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    processScheduleData(data) {
        const schedule = {};
        
        // Находим ключевые строки
        let monthsRowIdx = -1;
        let weeksRowIdx = -1;
        let firstDayRowIdx = -1;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            const rowStr = row.join(' ').toUpperCase();
            
            // Строка с месяцами
            if (rowStr.includes('ФЕВРАЛЬ') || rowStr.includes('МАРТ') || rowStr.includes('АПРЕЛЬ')) {
                monthsRowIdx = i;
            }
            // Строка с неделями (содержит "Неделя" или ">")
            if (row[1] && (String(row[1]).includes('>') || String(row[1]).toUpperCase().includes('НЕДЕЛ'))) {
                weeksRowIdx = i;
            }
            // Первая строка с днём недели
            if (row[1] && String(row[1]).toUpperCase() === 'ПОНЕДЕЛЬНИК' && firstDayRowIdx === -1) {
                firstDayRowIdx = i;
                break;
            }
        }

        console.log('Строка с месяцами:', monthsRowIdx);
        console.log('Строка с неделями:', weeksRowIdx);
        console.log('Первая строка с днём недели:', firstDayRowIdx);

        if (monthsRowIdx === -1 || firstDayRowIdx === -1) {
            console.error('Не удалось найти структуру расписания');
            return schedule;
        }

        // Строим начальный маппинг колонок к месяцам
        const monthsRow = data[monthsRowIdx];
        const monthNames = {
            'ФЕВРАЛЬ': 2, 'МАРТ': 3, 'АПРЕЛЬ': 4,
            'МАЙ': 5, 'ИЮНЬ': 6, 'ИЮЛЬ': 7,
            'ЯНВАРЬ': 1, 'АВГУСТ': 8, 'СЕНТЯБРЬ': 9,
            'ОКТЯБРЬ': 10, 'НОЯБРЬ': 11, 'ДЕКАБРЬ': 12
        };
        
        const daysInMonth = {
            1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
            7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
        };
        // 2026 не високосный
        
        // Для каждой колонки храним текущий месяц и предыдущую дату
        const columnState = {}; // col -> { month, prevDate }
        
        let currentMonth = null;
        for (let col = 2; col < (monthsRow ? monthsRow.length : 0); col++) {
            const cell = String(monthsRow[col] || '').toUpperCase().trim();
            if (monthNames[cell]) {
                currentMonth = monthNames[cell];
            }
            if (currentMonth) {
                columnState[col] = { month: currentMonth, prevDate: 0 };
            }
        }

        console.log('Начальный маппинг колонок:', columnState);

        // Парсим расписание
        let currentDay = '';
        let currentDates = {}; // колонка -> { day, month }
        const daysOfWeek = ['ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];
        
        for (let rowIdx = firstDayRowIdx; rowIdx < data.length; rowIdx++) {
            const row = data[rowIdx];
            if (!row || row.length === 0) continue;

            const col0 = String(row[0] || '').trim();
            const col1 = String(row[1] || '').trim().toUpperCase();

            // Проверяем, это строка с днём недели и датами?
            if (daysOfWeek.includes(col1)) {
                currentDay = col1;
                currentDates = {};
                
                // Собираем даты из этой строки
                for (let col = 2; col < row.length; col++) {
                    const dateVal = parseInt(row[col]);
                    if (isNaN(dateVal) || dateVal < 1 || dateVal > 31) continue;
                    if (!columnState[col]) continue;
                    
                    let { month, prevDate } = columnState[col];
                    
                    // Если дата меньше предыдущей - это следующий месяц
                    // Например: prevDate=30, dateVal=1 -> month++
                    if (prevDate > 0 && dateVal < prevDate && prevDate > 20) {
                        month = month + 1;
                        if (month > 12) month = 1; // переход на следующий год
                        columnState[col].month = month;
                    }
                    
                    columnState[col].prevDate = dateVal;
                    currentDates[col] = { day: dateVal, month: month };
                }
                
                console.log(`День: ${currentDay}, даты:`, currentDates);
                continue;
            }

            // Это строка с предметом
            const timeCell = col0;
            const subjectCell = String(row[1] || '').trim();
            
            // Пропускаем строки без предмета или служебные строки
            if (!subjectCell || subjectCell.length < 3) continue;
            if (subjectCell.toUpperCase().includes('ПРЕПОДАВАТЕЛЬ')) continue;
            if (subjectCell.toUpperCase().includes('НЕДЕЛЯ')) continue;
            if (daysOfWeek.includes(subjectCell.toUpperCase())) continue;

            // Определяем, это предмет или преподаватель
            const isTeacher = /преп\.|проф\.|доц\.|ст\.\s*преп/i.test(subjectCell);
            
            if (isTeacher) {
                // Это строка с преподавателем - ищем занятия
                const teacherName = subjectCell;
                
                for (let col = 2; col < row.length; col++) {
                    const cell = String(row[col] || '').trim();
                    if (!cell) continue;

                    const lessonType = this.extractLessonType(cell);
                    if (!lessonType) continue;

                    const dateInfo = currentDates[col];
                    if (!dateInfo) continue;

                    const dateKey = `2026-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`;
                    
                    // Ищем предмет из предыдущей строки
                    let subjectName = '';
                    let lessonTime = '';
                    
                    // Смотрим предыдущие строки чтобы найти название предмета
                    for (let prevRow = rowIdx - 1; prevRow >= firstDayRowIdx; prevRow--) {
                        const prev = data[prevRow];
                        if (!prev) continue;
                        
                        const prevCol1 = String(prev[1] || '').trim();
                        if (daysOfWeek.includes(prevCol1.toUpperCase())) break;
                        
                        if (prevCol1 && !(/преп\.|проф\.|доц\.|ст\.\s*преп/i.test(prevCol1))) {
                            subjectName = prevCol1;
                            lessonTime = String(prev[0] || '').trim().replace(/,/g, ', ').replace(/\r\n/g, ', ');
                            break;
                        }
                    }

                    if (!subjectName) continue;

                    // Извлекаем время из ячейки если указано
                    const timeFromCell = this.extractTimeFromCell(cell);
                    const finalTime = timeFromCell || lessonTime || '12:30-13:50';

                    if (!schedule[dateKey]) {
                        schedule[dateKey] = [];
                    }

                    // Проверяем дубликаты
                    const exists = schedule[dateKey].some(
                        l => l.subject === subjectName && l.type === lessonType
                    );

                    if (!exists) {
                        schedule[dateKey].push({
                            subject: subjectName,
                            teacher: teacherName,
                            time: finalTime,
                            type: lessonType,
                            typeFull: this.lessonTypes[lessonType] || lessonType,
                            day: currentDay
                        });
                        console.log(`✅ Добавлено: ${dateKey} - ${subjectName} (${lessonType})`);
                    }
                }
            } else {
                // Это строка с названием предмета - ищем занятия здесь тоже
                const subjectName = subjectCell;
                const lessonTime = timeCell.replace(/,/g, ', ').replace(/\r\n/g, ', ');
                
                for (let col = 2; col < row.length; col++) {
                    const cell = String(row[col] || '').trim();
                    if (!cell) continue;

                    const lessonType = this.extractLessonType(cell);
                    if (!lessonType) continue;

                    const dateInfo = currentDates[col];
                    if (!dateInfo) continue;

                    const dateKey = `2026-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`;
                    const timeFromCell = this.extractTimeFromCell(cell);
                    const finalTime = timeFromCell || lessonTime || '12:30-13:50';

                    if (!schedule[dateKey]) {
                        schedule[dateKey] = [];
                    }

                    const exists = schedule[dateKey].some(
                        l => l.subject === subjectName && l.type === lessonType
                    );

                    if (!exists) {
                        schedule[dateKey].push({
                            subject: subjectName,
                            teacher: '',
                            time: finalTime,
                            type: lessonType,
                            typeFull: this.lessonTypes[lessonType] || lessonType,
                            day: currentDay
                        });
                        console.log(`✅ Добавлено: ${dateKey} - ${subjectName} (${lessonType})`);
                    }
                }
            }
        }

        console.log('Итого расписание:', schedule);
        return schedule;
    }

    extractLessonType(cell) {
        const upperCell = cell.toUpperCase();
        
        if (upperCell.includes('ЗАЧ')) return 'ЗАЧ';
        if (upperCell.includes('ЛАБ')) return 'Лаб';
        if (upperCell.includes('ПЗ')) return 'ПЗ';
        if (upperCell.includes('ВЛ')) return 'ВЛ';
        
        // Проверяем Л и С как отдельные символы
        const trimmed = cell.trim();
        if (trimmed === 'Л' || trimmed === 'л') return 'Л';
        if (trimmed === 'С' || trimmed === 'с') return 'С';
        
        // Л или С с временем
        if (/^Л\s*\d|^Л$/i.test(trimmed)) return 'Л';
        if (/^С\s*\d|^С$/i.test(trimmed)) return 'С';
        
        return null;
    }

    extractTimeFromCell(cell) {
        const timeMatch = cell.match(/(\d{1,2})[.:](\d{2})/);
        if (timeMatch) {
            return `${timeMatch[1]}:${timeMatch[2]}`;
        }
        return null;
    }

    saveToLocalStorage() {
        localStorage.setItem('schedule', JSON.stringify(this.schedule));
        localStorage.setItem('scheduleUpdated', new Date().toISOString());
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('schedule');
        if (saved) {
            this.schedule = JSON.parse(saved);
            return this.schedule;
        }
        return null;
    }

    getScheduleForDate(date) {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return this.schedule[dateKey] || [];
    }

    getAllDatesWithClasses() {
        return Object.keys(this.schedule);
    }

    getLastUpdateTime() {
        const updated = localStorage.getItem('scheduleUpdated');
        return updated ? new Date(updated) : null;
    }
}

window.ScheduleParser = ScheduleParser;
