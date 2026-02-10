class Calendar {
  constructor(containerId, parser) {
    this.container = document.getElementById(containerId);
    this.parser = parser;
    this.currentDate = new Date();
    this.daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    this.monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];
  }

  render() {
    this.container.innerHTML = "";

    // Заголовки дней недели
    this.daysOfWeek.forEach((day) => {
      const header = document.createElement("div");
      header.className = "calendar-header";
      header.textContent = day;
      this.container.appendChild(header);
    });

    // Получаем данные о месяце
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = (firstDay.getDay() + 6) % 7; // Понедельник = 0
    const totalDays = lastDay.getDate();
    const today = new Date();

    // Пустые ячейки до первого дня
    for (let i = 0; i < startingDay; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "calendar-day empty";
      this.container.appendChild(emptyDay);
    }

    // Дни месяца
    for (let day = 1; day <= totalDays; day++) {
      const dayElement = document.createElement("div");
      dayElement.className = "calendar-day";

      const currentDateObj = new Date(year, month, day);
      const classes = this.parser.getScheduleForDate(currentDateObj);

      // Проверяем, есть ли занятия
      if (classes.length > 0) {
        dayElement.classList.add("has-classes");
      }

      // Проверяем, сегодня ли это
      if (
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      ) {
        dayElement.classList.add("today");
      }

      dayElement.innerHTML = `
                <span class="date">${day}</span>
                ${classes.length > 0 ? `<span class="class-count">${classes.length} зан.</span>` : ""}
            `;

      dayElement.addEventListener("click", () => {
        this.showDayDetails(currentDateObj, classes);
      });

      this.container.appendChild(dayElement);
    }
  }

  showDayDetails(date, classes) {
    const modal = document.getElementById("day-modal");
    const modalDate = document.getElementById("modal-date");
    const modalSchedule = document.getElementById("modal-schedule");

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    modalDate.textContent = date.toLocaleDateString("ru-RU", options);

    if (classes.length === 0) {
      modalSchedule.innerHTML =
        '<div class="no-classes"><i class="ri-cup-line"></i> Занятий нет!</div>';
    } else {
      // Сортируем по времени (числовое сравнение)
      classes.sort((a, b) => {
        const getMinutes = (timeStr) => {
          const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
          return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 999;
        };
        return getMinutes(a.time) - getMinutes(b.time);
      });

      modalSchedule.innerHTML = classes
        .map((lesson) => {
          const typeClass = this.getTypeClass(lesson.type);
          return `
                    <div class="lesson ${typeClass}">
                        <div class="lesson-name">${lesson.subject}</div>
                        <div class="lesson-info">
                            <div><i class="ri-time-line"></i> ${lesson.time}</div>
                            ${lesson.teacher ? `<div><i class="ri-user-line"></i> ${lesson.teacher}</div>` : ""}
                        </div>
                        <span class="lesson-type type-${lesson.type}">${lesson.typeFull}</span>
                    </div>
                `;
        })
        .join("");
    }

    modal.classList.add("active");
  }

  getTypeClass(type) {
    const classes = {
      Л: "lecture",
      ПЗ: "practice",
      С: "seminar",
      ВЛ: "lecture",
      Лаб: "lab",
      ЗАЧ: "exam",
    };
    return classes[type] || "";
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.updateMonthDisplay();
    this.render();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.updateMonthDisplay();
    this.render();
  }

  updateMonthDisplay() {
    const monthDisplay = document.getElementById("current-month");
    monthDisplay.textContent = `${this.monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }

  goToDate(date) {
    this.currentDate = new Date(date);
    this.updateMonthDisplay();
    this.render();
  }
}

window.Calendar = Calendar;
