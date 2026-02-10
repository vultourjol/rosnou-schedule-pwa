document.addEventListener("DOMContentLoaded", () => {
  const parser = new ScheduleParser();
  const calendar = new Calendar("calendar", parser);

  // Загружаем сохранённое расписание
  const savedSchedule = parser.loadFromLocalStorage();
  if (savedSchedule) {
    console.log("✅ Загружено расписание из кэша");
    const lastUpdate = parser.getLastUpdateTime();
    if (lastUpdate) {
      console.log(
        "📅 Последнее обновление:",
        lastUpdate.toLocaleString("ru-RU"),
      );
    }
  } else {
    console.log("ℹ️ Расписание не найдено. Загрузите Excel файл.");
  }

  // Инициализация календаря
  calendar.updateMonthDisplay();
  calendar.render();
  renderTodaySchedule();

  // Функция отображения расписания на сегодня
  function renderTodaySchedule() {
    const today = new Date();
    const todayTitle = document.getElementById("today-title");
    const todayLessons = document.getElementById("today-lessons");

    const options = { weekday: "long", day: "numeric", month: "long" };
    const dateStr = today.toLocaleDateString("ru-RU", options);
    todayTitle.innerHTML = `<i class="ri-pushpin-fill"></i> Сегодня, ${dateStr}`;

    const classes = parser.getScheduleForDate(today);

    if (classes.length === 0) {
      todayLessons.innerHTML =
        '<div class="no-classes"><i class="ri-cup-line"></i> Занятий нет!</div>';
    } else {
      // Сортируем по времени
      classes.sort((a, b) => {
        const getMinutes = (timeStr) => {
          const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
          return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 999;
        };
        return getMinutes(a.time) - getMinutes(b.time);
      });

      todayLessons.innerHTML = classes
        .map((lesson) => {
          const typeClass = getTypeClass(lesson.type);
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
  }

  function getTypeClass(type) {
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

  // Навигация по месяцам
  document.getElementById("prev-month").addEventListener("click", () => {
    calendar.prevMonth();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    calendar.nextMonth();
  });

  // Свайпы для мобильных устройств
  let touchStartX = 0;
  let touchEndX = 0;

  const calendarEl = document.getElementById("calendar");

  calendarEl.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  calendarEl.addEventListener(
    "touchend",
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    },
    { passive: true },
  );

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        calendar.nextMonth();
      } else {
        calendar.prevMonth();
      }
    }
  }

  // Загрузка файла
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("file-input");

  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadBtn.textContent = "Загрузка...";
    uploadBtn.disabled = true;

    try {
      await parser.parseExcel(file);
      calendar.render();
      renderTodaySchedule();

      const totalDates = Object.keys(parser.schedule).length;
      let totalClasses = 0;
      for (const date in parser.schedule) {
        totalClasses += parser.schedule[date].length;
      }

      uploadBtn.textContent = "Загружено!";
      console.log(`Загружено ${totalClasses} занятий на ${totalDates} дней`);

      // Показываем уведомление
      showNotification(`Загружено ${totalClasses} занятий`);

      setTimeout(() => {
        uploadBtn.textContent = "Загрузить Excel";
        uploadBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Ошибка парсинга:", error);
      uploadBtn.textContent = "Ошибка";

      showNotification("Ошибка загрузки файла", true);

      setTimeout(() => {
        uploadBtn.textContent = "Загрузить Excel";
        uploadBtn.disabled = false;
      }, 2000);
    }

    // Сбрасываем input для повторной загрузки того же файла
    fileInput.value = "";
  });

  // Функция закрытия модального окна с анимацией
  function closeModal(modalElement) {
    modalElement.classList.add("closing");
    setTimeout(() => {
      modalElement.classList.remove("active", "closing");
    }, 200);
  }

  // Закрытие модального окна расписания
  const modal = document.getElementById("day-modal");
  const closeBtn = modal.querySelector(".close");

  closeBtn.addEventListener("click", () => {
    closeModal(modal);
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });

  // Модальное окно помощи
  const helpModal = document.getElementById("help-modal");
  const helpBtn = document.getElementById("help-btn");
  const helpClose = document.getElementById("help-close");

  helpBtn.addEventListener("click", () => {
    helpModal.classList.add("active");
  });

  helpClose.addEventListener("click", () => {
    closeModal(helpModal);
  });

  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
      closeModal(helpModal);
    }
  });

  // Закрытие по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modal.classList.contains("active")) closeModal(modal);
      if (helpModal.classList.contains("active")) closeModal(helpModal);
    }
  });

  // Регистрация Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("✅ Service Worker зарегистрирован"))
      .catch((err) => console.error("❌ Service Worker ошибка:", err));
  }

  // Функция показа уведомлений
  function showNotification(message, isError = false) {
    // Создаём элемент уведомления
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isError ? "#f44336" : "#4CAF50"};
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 15px;
            font-size: 0.85rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 2000;
            animation: fadeInUp 0.3s ease;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "fadeOutDown 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Добавляем стили для анимации
  const style = document.createElement("style");
  style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOutDown {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
    `;
  document.head.appendChild(style);
});
