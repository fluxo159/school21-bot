
// Проверить, является ли слот текущим
// Проверить, является ли слот текущим
function checkIfSlotIsNow(slots) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return false;
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
    
    return slots.some(slot => {
        if (!slot.start_time || !slot.end_time) return false;
        return currentTime >= slot.start_time && currentTime < slot.end_time;
    });
}

// Инициализация глобальных переменных
if (!window.currentBusySlots) {
    window.currentBusySlots = [];
}
if (!window.userCoins) {
    window.userCoins = 100;
}

function isTimeInPast(selectedDate, selectedTime) {
	const now = new Date()
	const selectedDateTime = new Date(`${selectedDate}T${selectedTime}`)
	return selectedDateTime < now
}
// Проверить, является ли время занятым
function isTimeSlotBusy(roomId, date, startTime, endTime) {
    // TODO: Реализовать проверку через API
    // Пока возвращаем заглушку
    return false;
}
async function getBusyTimeSlots(roomId, date) {
	try {
		const response = await fetch(`/api/rooms/${roomId}/busy-slots?date=${date}`)
		if (response.ok) {
			const data = await response.json()
			return data.busy_slots || []
		}
		return []
	} catch (error) {
		console.error('Ошибка получения занятых слотов:', error)
		return []
	}
}


// Функция для получения сегодняшней даты в формате YYYY-MM-DD (локальное время)
// Используем локальное время вместо UTC, чтобы избежать проблем с часовыми поясами
// Для Узбекистана (UTC+5) это гарантирует правильное определение "сегодняшней" даты
function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Получить следующие 7 дней
function getNextDays() {
    const days = [];
    const today = new Date();
    
    // Получаем дни недели из переводов
    let dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    if (window.t && window.translations && window.translations[window.currentLanguage] && window.translations[window.currentLanguage].dayNames) {
        dayNames = window.translations[window.currentLanguage].dayNames;
    }
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayName = dayNames[date.getDay()];
        const dayNum = date.getDate();
        
        // Используем локальное время для даты
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        days.push({
            label: i === 0 ? (window.t ? window.t('today') : 'Сегодня') : 
                   i === 1 ? (window.t ? window.t('tomorrow') : 'Завтра') : 
                   `${dayName} ${dayNum}`,
            fullLabel: i === 0 ? (window.t ? window.t('today') : 'Сегодня') : 
                       i === 1 ? (window.t ? window.t('tomorrow') : 'Завтра') : 
                       date.toLocaleDateString(window.currentLanguage === 'uz' ? 'uz-UZ' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
            value: dateString,
            date: date
        });
    }
    
    return days;
}

// Обновленная функция генерации временных слотов (24-часовой режим: 0:00-24:00)
function getTimeSlots() {
    const slots = [];
    const now = new Date();
    const today = getTodayDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // Генерируем слоты с 0:00 до 23:00 (24 часа)
    for (let hour = 0; hour < 24; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00:00`;
        const slotTotalMinutes = hour * 60;
        // Слот считается прошедшим, если его время уже прошло
        // Например, если сейчас 1:39 (99 минут), то:
        // - Слот 1:00 (60 минут) - прошедший (60 < 99) ✅
        // - Слот 2:00 (120 минут) - НЕ прошедший (120 > 99) ✅
        // Слот считается прошедшим только если его время СТРОГО меньше текущего времени
        // Используем < вместо <=, чтобы слот 2:00 был доступен, если сейчас меньше 2:00
        const isPast = slotTotalMinutes < currentTotalMinutes;
        
        slots.push({
            label: `${hour.toString().padStart(2, '0')}:00`,
            value: timeStr,
            hour: hour,
            isPast: isPast
        });
    }
    
    return slots;
}

// Открыть модальное окно бронирования
function openBookingModal(room) {
	window.selectedRoom = room
	window.bookingStep = 'select-date'
	
	// Очищаем занятые слоты при открытии модального окна
	window.currentBusySlots = []
	
	// Проверяем и очищаем выбранные данные, особенно прошедшие даты
	const today = getTodayDateString()
	const savedDate = localStorage.getItem('selectedDate')
	
	if (savedDate && savedDate < today) {
		console.log(`⚠️ Сохраненная дата ${savedDate} в прошлом (сегодня: ${today}), очищаем выбор`)
		localStorage.removeItem('selectedDate')
		localStorage.removeItem('selectedTime')
		localStorage.removeItem('selectedHours')
	} else {
		// Очищаем выбранные данные в любом случае при открытии нового бронирования
		localStorage.removeItem('selectedDate')
		localStorage.removeItem('selectedTime')
		localStorage.removeItem('selectedHours')
	}
	
	console.log(`🚪 Открываем бронирование комнаты: ${room.name}`)
	
	// Показываем предупреждение если мало коинов
	if (window.userCoins < room.price) {
		const missing = room.price - window.userCoins
		console.log(`⚠️ Внимание: мало коинов! Нужно еще ${missing} 🪙`)
	}
	
	window.showBookingModal()
}

async function showBookingModal() {
	// Проверяем, не существует ли уже модальное окно
	const existingModal = document.getElementById('booking-modal')
	if (existingModal) {
		console.log('⚠️ Модальное окно уже существует, удаляем старое')
		existingModal.remove()
	}
	
	const modalHtml = generateBookingModal()
	document.body.insertAdjacentHTML('beforeend', modalHtml)

	// Если это шаг выбора времени, загружаем контент асинхронно
	if (window.bookingStep === 'select-time') {
		await loadTimeSelectionContent()
	} else {
		initCalendar()
	}
}

async function loadTimeSelectionContent() {
	const modal = document.getElementById('booking-modal')
	const contentContainer = modal.querySelector('#modal-step-content')

	// Проверяем выбранную дату перед загрузкой времени
	const selectedDate = localStorage.getItem('selectedDate')
	const today = getTodayDateString()
	
	console.log('🔍 Проверка даты при загрузке времени:', {
		selectedDate,
		today,
		comparison: selectedDate < today,
		selectedDateType: typeof selectedDate,
		todayType: typeof today
	})
	
	if (!selectedDate) {
		console.warn('⚠️ Дата не выбрана, возвращаемся к выбору даты')
		window.bookingStep = 'select-date'
		updateBookingModal()
		return
	}
	
	// Проверяем, что дата не в прошлом (строгое сравнение строк)
	if (selectedDate < today) {
		console.error(`❌ Выбранная дата в прошлом: ${selectedDate} < ${today}`)
		alert(`❌ ${window.t ? window.t('pastDateError') : 'Выбранная дата уже прошла! Пожалуйста, выберите сегодня или будущую дату.'}`)
		localStorage.removeItem('selectedDate')
		localStorage.removeItem('selectedTime')
		localStorage.removeItem('selectedHours')
		window.bookingStep = 'select-date'
		updateBookingModal()
		return
	}

		if (contentContainer) {
			try {
				const content = await getTimeSelectionContent()
				contentContainer.innerHTML = content
				// Убираем класс loading-dots когда загрузка завершена
				const loadingElement = contentContainer.querySelector('.loading-dots')
				if (loadingElement) loadingElement.classList.remove('loading-dots')
				// После загрузки контента инициализируем календарь
				setTimeout(() => {
					initCalendar()
				}, 100)
			} catch (error) {
				console.error('Ошибка загрузки расписания:', error)
				contentContainer.innerHTML = `
                <div class="text-center p-8">
                    <p class="text-danger">${window.t ? window.t('errorLoadingSchedule') : 'Ошибка загрузки расписания'}</p>
                    <button class="btn btn-secondary mt-4" onclick="closeBookingModal()">
                        ${window.t ? window.t('close') : 'Закрыть'}
                    </button>
                </div>
            `
				// Убираем класс loading-dots при ошибке
				const loadingElement = contentContainer.querySelector('.loading-dots')
				if (loadingElement) loadingElement.classList.remove('loading-dots')
			}
		}
}

// Генерация HTML для модального окна
function generateBookingModal() {
	let stepContent = ''

	// Для шага select-time будем загружать контент асинхронно
	if (window.bookingStep === 'select-time') {
		stepContent = `
            <div class="text-center p-8">
                <div class="spinner" style="margin: 20px auto;"></div>
                <p class="text-gray mt-4 loading-dots" style="font-size: 14px;">${window.t ? window.t('loadingSchedule') : 'Загружаем расписание'}</p>
            </div>
        `
	} else {
		stepContent = getBookingStepContent()
	}

	const stepTitle = window.bookingStep === 'select-date'
		? `📅 ${window.t ? window.t('selectDate') : 'Выберите дату'}`
		: window.bookingStep === 'select-time'
		? '🕐 Выберите время'
		: '✓ Подтверждение'

	return `
        <div class="modal-overlay" id="booking-modal">
            <div class="modal-content">
                <div class="card-header">
                    <h2>${stepTitle}</h2>
                </div>
                
                <div class="p-6" id="modal-step-content">
                    ${stepContent}
                </div>
            </div>
        </div>
    `
}

// Получить контент для текущего шага
function getBookingStepContent() {
    switch(window.bookingStep) {
        case 'select-date':
            return getDateSelectionContent();
        case 'select-time':
            return getTimeSelectionContent();
        case 'confirm':
            return getConfirmationContent();
        default:
            return '';
    }
}

// Контент выбора даты
function getDateSelectionContent() {
    const days = getNextDays();
    
    return `
        <div class="mb-4">
            <p class="text-gray mb-3" style="font-size: 15px; font-weight: 600;">${window.t ? window.t('selectDate') : 'Выберите дату бронирования'}</p>
            <div class="calendar-grid" id="calendar-days">
                ${days.map(day => `
                    <button class="day-btn" data-date="${day.value}">
                        ${day.label}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <button class="btn btn-secondary" onclick="closeBookingModal()">
            ${window.t ? window.t('cancel') : 'Отмена'}
        </button>
    `;
}

// Контент выбора времени
// Убедимся что функция НЕ async
function getTimeSelectionContent() {
    const slots = getTimeSlots();
    const selectedDate = localStorage.getItem('selectedDate');
    const today = getTodayDateString();
    const isToday = selectedDate === today;
    
    // Получаем занятые слоты из глобальной переменной (загружены заранее)
    const busySlots = Array.isArray(window.currentBusySlots)
			? window.currentBusySlots
			: []
    
    console.log('📅 Занятые слоты для отображения:', busySlots)
    console.log('📅 Выбранная дата:', selectedDate, 'Сегодня:', today, 'isToday:', isToday)
    
    // Создаем HTML для временных слотов
    let timeSlotsHTML = '';
    slots.forEach(slot => {
        // Проверяем, является ли слот прошедшим
        // Для сегодняшней даты проверяем текущее время
        let isPast = false;
        if (isToday) {
            // Используем значение isPast из слота, которое было вычислено в getTimeSlots()
            // Явно проверяем true, чтобы избежать проблем с undefined/null
            isPast = slot.isPast === true;
            
            // Дополнительная проверка для точности
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const slotHour = slot.hour;
            const currentTotalMinutes = currentHour * 60 + currentMinute;
            const slotTotalMinutes = slotHour * 60;
            
            // Перепроверяем isPast на основе текущего времени
            // Слот считается прошедшим, если его время строго меньше текущего
            isPast = slotTotalMinutes < currentTotalMinutes;
            
            // Логируем для отладки первые несколько слотов
            if (slotHour < 3 || slotHour >= 20) {
                console.log(`🕐 Слот ${slot.label}: isPast=${isPast}, slotHour=${slotHour} (${slotTotalMinutes} мин), current=${currentHour}:${currentMinute} (${currentTotalMinutes} мин)`)
            }
        }
        
        // Проверяем занятость с учетом перехода через полночь и находим логин пользователя
        let busySlotInfo = null;
        const isBusy = busySlots.some(busySlot => {
            const slotTime = slot.value; // формат: "HH:MM:SS"
            const busyStart = busySlot.start_time; // формат: "HH:MM" или "HH:MM:SS"
            const busyEnd = busySlot.end_time; // формат: "HH:MM" или "HH:MM:SS"
            
            // Нормализуем форматы времени
            const normalizeTime = (timeStr) => {
                if (!timeStr) return null;
                // Убираем секунды если есть
                const parts = timeStr.split(':');
                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            };
            
            const slotTimeNorm = normalizeTime(slotTime);
            const busyStartNorm = normalizeTime(busyStart);
            const busyEndNorm = normalizeTime(busyEnd);
            
            if (!busyStartNorm || !busyEndNorm) return false;
            
            // Если end_time < start_time, это переход через полночь
            const crossesMidnight = busyEndNorm < busyStartNorm;
            
            let matches = false;
            if (crossesMidnight) {
                // При переходе через полночь для текущего дня показываем только слоты от start_time до 23:59
                // Слоты от 00:00 до end_time должны показываться на следующем дне
                matches = slotTimeNorm >= busyStartNorm && slotTimeNorm <= '23:59';
            } else {
                // Обычная проверка без перехода через полночь
                matches = slotTimeNorm >= busyStartNorm && slotTimeNorm < busyEndNorm;
            }
            
            // Если слот занят, сохраняем информацию о бронировании
            if (matches && !busySlotInfo) {
                busySlotInfo = busySlot;
            }
            
            return matches;
        });
        const isDisabled = isPast || isBusy;
        const buttonClass = isBusy ? 'time-btn busy' : (isPast ? 'time-btn past' : 'time-btn');
        
        // Формируем содержимое кнопки
        let buttonContent = slot.label;
        if (isBusy && busySlotInfo && busySlotInfo.user_login) {
            buttonContent += `<br><span style="font-size:10px;color:#dc2626;font-weight:600;">${window.t ? window.t('busyStatus') : 'Занято'}</span>`;
            buttonContent += `<br><span style="font-size:11px;color:#94a3b8;margin-top:2px;display:block;">${busySlotInfo.user_login}</span>`;
        } else if (isBusy) {
            buttonContent += `<br><span style="font-size:10px;color:#dc2626;">${window.t ? window.t('busyStatus') : 'Занято'}</span>`;
        }
        if (isPast) {
            buttonContent += `<br><span style="font-size:10px;color:#94a3b8;">${window.t ? window.t('past') : 'Прошло'}</span>`;
        }
        
        timeSlotsHTML += `
            <button class="${buttonClass}" data-time="${slot.value}" ${isDisabled ? 'disabled' : ''}>
                ${buttonContent}
            </button>
        `;
    });
    
    return `
        <div class="mb-4">
            <p class="text-gray mb-3" style="font-size: 15px; font-weight: 600;">${window.t ? window.t('selectTime') : 'Время начала'}</p>
            <div class="time-grid" id="time-slots">
                ${timeSlotsHTML}
            </div>
        </div>
        
        <div class="mb-4">
            <p class="text-gray mb-3" style="font-size: 15px; font-weight: 600;">${window.t ? window.t('duration') : 'Длительность'}</p>
            <div class="hours-grid" id="hours-selection">
                ${[1, 2, 3, 4].map(hours => `
                    <button class="hour-btn" data-hours="${hours}">
                        <div style="font-size: 18px; font-weight: 700;">${hours} ${window.t ? (hours > 1 ? window.t('hours') : window.t('hour')) : (hours > 1 ? 'часа' : 'час')}</div>
                        <div style="font-size: 13px; margin-top: 4px; color: #3B82F6;">${window.selectedRoom.price * hours} 🪙</div>
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="flex space-between gap-2">
            <button class="btn btn-secondary flex-1" onclick="window.bookingStep = 'select-date'; updateBookingModal()">
                <i class="fas fa-arrow-left"></i>&nbsp; ${window.t ? window.t('back') : 'Назад'}
            </button>
            <button class="btn btn-primary flex-1" onclick="goToConfirmation()" id="next-btn" disabled>
                ${window.t ? window.t('next') : 'Далее'} &nbsp;<i class="fas fa-arrow-right"></i>
            </button>
        </div>
        
        <div class="mt-4" style="padding: 16px; background: rgba(59, 130, 246, 0.08); border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.15);">
            <div class="flex items-center" style="gap: 16px; font-size: 12px;">
                <div class="flex items-center">
                    <div class="legend-color legend-free"></div>
                    <span class="text-gray">${window.t ? window.t('free') : 'Свободно'}</span>
                </div>
                <div class="flex items-center">
                    <div class="legend-color legend-busy"></div>
                    <span class="text-gray">${window.t ? window.t('busyStatus') : 'Занято'}</span>
                </div>
                <div class="flex items-center">
                    <div class="legend-color legend-past"></div>
                    <span class="text-gray">${window.t ? window.t('past') : 'Прошло'}</span>
                </div>
            </div>
        </div>
    `;
}

// Контент подтверждения
function getConfirmationContent() {
    const selectedDate = localStorage.getItem('selectedDate');
    const selectedTime = localStorage.getItem('selectedTime');
    const selectedHours = parseInt(localStorage.getItem('selectedHours') || '1');
    const totalPrice = window.selectedRoom.price * selectedHours;
    
    const date = new Date(selectedDate);
    const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
    });
    
    return `
        <div class="mb-4">
            <h3 class="mb-4" style="font-size: 20px; font-weight: 700; text-align: center;">${window.t ? window.t('confirmBookingTitle') : 'Подтвердите бронирование'}</h3>
            
            <div class="card mb-4" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2);">
                <div class="room-header mb-3">
                    <div class="room-name" style="font-size: 18px;">${window.selectedRoom.name}</div>
                    <div style="font-size: 16px; color: #3B82F6; font-weight: 700;">${window.selectedRoom.price} 🪙/час</div>
                </div>
                
                <div class="space-y-2" style="font-size: 14px; line-height: 2;">
                    <div style="display: flex; justify-content: space-between;">
                        <span class="text-gray">📅 Дата:</span>
                        <span style="font-weight: 600;">${dateStr}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span class="text-gray">🕐 ${window.t ? window.t('time') : 'Время'}:</span>
                        <span style="font-weight: 600;">${selectedTime.slice(0, 5)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span class="text-gray">⏱️ ${window.t ? window.t('duration') : 'Длительность'}:</span>
                        <span style="font-weight: 600;">${selectedHours} ${window.t ? (selectedHours > 1 ? window.t('hours') : window.t('hour')) : (selectedHours > 1 ? 'часа' : 'час')}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 12px; border-top: 1px solid rgba(59, 130, 246, 0.15);">
                        <span class="text-gray">💰 ${window.t ? window.t('cost') : 'Стоимость'}:</span>
                        <span style="font-weight: 700; color: #3B82F6; font-size: 16px;">${totalPrice} 🪙</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span class="text-gray">👤 ${window.t ? window.t('yourBalance') : 'Ваш баланс:'}</span>
                        <span style="font-weight: 600;">${window.userCoins} 🪙</span>
                    </div>
                </div>
            </div>
            
            ${totalPrice > window.userCoins ? `
                <div class="card mb-4" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2);">
                    <p class="text-center" style="font-size: 14px; color: #dc2626; font-weight: 600;">
                        ⚠️ ${window.t ? window.t('insufficientCoins') : 'Недостаточно коинов'}<br>
                        <span style="font-size: 13px; font-weight: 500;">${window.t ? window.t('needed') : 'Нужно'} ${window.t ? window.t('more') : 'еще'}: ${totalPrice - window.userCoins} 🪙</span>
                    </p>
                </div>
            ` : ''}
        </div>
        
        <div class="flex space-between gap-2">
            <button class="btn btn-secondary flex-1" onclick="window.bookingStep = 'select-time'; updateBookingModal()">
                <i class="fas fa-arrow-left"></i>&nbsp; ${window.t ? window.t('back') : 'Назад'}
            </button>
            <button class="btn btn-primary flex-1" onclick="confirmBooking()" 
                    ${totalPrice > window.userCoins ? 'disabled' : ''}>
                <i class="fas fa-check"></i>&nbsp; ${window.t ? window.t('confirmBookingBtnText') : 'Подтвердить'}
            </button>
        </div>
    `;
}

async function loadBusySlotsForDate(roomId, date) {
	try {
		console.log(`📅 Загружаем занятые слоты для комнаты ${roomId} на дату ${date}`)
		const response = await fetch(`/api/rooms/${roomId}/busy-slots?date=${date}`)
		if (response.ok) {
			const data = await response.json()
			window.currentBusySlots = data.busy_slots || []
			console.log(`✅ Загружено ${window.currentBusySlots.length} занятых слотов для даты ${date}:`, window.currentBusySlots)
			return window.currentBusySlots
		}
		console.warn(`⚠️ Не удалось загрузить занятые слоты для даты ${date}`)
		window.currentBusySlots = []
		return []
	} catch (error) {
		console.error('Ошибка загрузки занятых слотов:', error)
		window.currentBusySlots = []
		return []
	}
}

// Инициализация календаря
async function initCalendar() {
	const modal = document.getElementById('booking-modal')
	if (!modal) {
		console.error('❌ Модальное окно не найдено для инициализации календаря')
		return
	}

	// Проверяем сохраненную дату и сбрасываем, если она в прошлом
	const savedDate = localStorage.getItem('selectedDate')
	const today = getTodayDateString()
	if (savedDate && savedDate < today) {
		console.log(`⚠️ Сохраненная дата ${savedDate} в прошлом, сбрасываем выбор`)
		localStorage.removeItem('selectedDate')
		localStorage.removeItem('selectedTime')
		localStorage.removeItem('selectedHours')
	}

	// Удаляем старые обработчики, если они были сохранены
	if (modal._calendarHandlers) {
		modal._calendarHandlers.forEach(({ element, handler, event }) => {
			element.removeEventListener(event, handler)
		})
	}
	modal._calendarHandlers = []

	// Выбор даты - используем делегирование событий для избежания дублирования
	const calendarGrid = modal.querySelector('#calendar-days')
	if (calendarGrid) {
		const dateClickHandler = async function (e) {
			const btn = e.target.closest('.day-btn')
			if (!btn) return
			
			e.preventDefault()
			e.stopPropagation()
			
			const clickedDate = btn.dataset.date
			const today = getTodayDateString()
			
			console.log('🔍 Проверка даты при клике:', {
				clickedDate,
				today,
				comparison: clickedDate < today,
				clickedDateType: typeof clickedDate,
				todayType: typeof today
			})
			
			// Проверяем, что выбранная дата не в прошлом
			// Используем строгое сравнение строк дат в формате YYYY-MM-DD
			if (clickedDate && clickedDate < today) {
				console.error('❌ Попытка выбрать прошедшую дату:', clickedDate, 'сегодня:', today)
				alert(`❌ ${window.t ? window.t('pastDateError') : 'Нельзя выбрать прошедшую дату! Пожалуйста, выберите сегодня или будущую дату.'}`)
				return
			}
			
			console.log('📅 Клик по дате:', clickedDate)
			
			// Снять активный класс со всех кнопок
			modal.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'))
			// Добавить активный класс текущей кнопке
			btn.classList.add('active')

			const date = btn.dataset.date
			localStorage.setItem('selectedDate', date)

			// Предзагружаем занятые слоты для выбранной даты
			if (window.selectedRoom) {
				console.log(`📅 Выбрана дата: ${date}, загружаем занятые слоты...`)
				await loadBusySlotsForDate(window.selectedRoom.id, date)
			} else {
				console.warn('⚠️ window.selectedRoom не установлена при выборе даты')
			}

			// Перейти к выбору времени через 300мс
			setTimeout(() => {
				window.bookingStep = 'select-time'
				updateBookingModal()
			}, 300)
		}
		
		calendarGrid.addEventListener('click', dateClickHandler)
		modal._calendarHandlers.push({ element: calendarGrid, handler: dateClickHandler, event: 'click' })
	}

	// Выбор времени - используем делегирование событий
	setTimeout(() => {
		const timeSlots = modal.querySelector('#time-slots')
		if (timeSlots) {
			const timeClickHandler = function (e) {
				const btn = e.target.closest('.time-btn:not(:disabled)')
				if (!btn) return
				
				e.preventDefault()
				e.stopPropagation()
				
				console.log('🕐 Клик по времени:', btn.dataset.time)
				
				// Снять активный класс со всех кнопок времени
				timeSlots.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'))
				// Добавить активный класс текущей кнопке
				btn.classList.add('active')

				const time = btn.dataset.time
				localStorage.setItem('selectedTime', time)
				checkTimeSelection()
			}
			
			// Удаляем старый обработчик, если был
			if (timeSlots._timeHandler) {
				timeSlots.removeEventListener('click', timeSlots._timeHandler)
			}
			timeSlots.addEventListener('click', timeClickHandler)
			timeSlots._timeHandler = timeClickHandler
			modal._calendarHandlers.push({ element: timeSlots, handler: timeClickHandler, event: 'click' })
		}

		// Выбор часов - используем делегирование событий
		const hoursSelection = modal.querySelector('#hours-selection')
		if (hoursSelection) {
			const hoursClickHandler = function (e) {
				const btn = e.target.closest('.hour-btn')
				if (!btn) return
				
				e.preventDefault()
				e.stopPropagation()
				
				console.log('⏰ Клик по часам:', btn.dataset.hours)
				
				// Снять активный класс со всех кнопок часов
				hoursSelection.querySelectorAll('.hour-btn').forEach(b => b.classList.remove('active'))
				// Добавить активный класс текущей кнопке
				btn.classList.add('active')

				const hours = btn.dataset.hours
				localStorage.setItem('selectedHours', hours)
				checkTimeSelection()
			}
			
			// Удаляем старый обработчик, если был
			if (hoursSelection._hoursHandler) {
				hoursSelection.removeEventListener('click', hoursSelection._hoursHandler)
			}
			hoursSelection.addEventListener('click', hoursClickHandler)
			hoursSelection._hoursHandler = hoursClickHandler
			modal._calendarHandlers.push({ element: hoursSelection, handler: hoursClickHandler, event: 'click' })
		}
	}, 100)
}

// Проверка выбора времени для активации кнопки "Далее"
function checkTimeSelection() {
    const modal = document.getElementById('booking-modal');
    const nextBtn = modal.querySelector('#next-btn');
    
    if (nextBtn) {
        const hasTime = localStorage.getItem('selectedTime');
        const hasHours = localStorage.getItem('selectedHours');
        nextBtn.disabled = !(hasTime && hasHours);
    }
}

// Перейти к подтверждению
function goToConfirmation() {
    window.bookingStep = 'confirm';
    updateBookingModal();
}

// Обновить модальное окно
async function updateBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        // Сохраняем текущий шаг перед удалением
        const currentStep = window.bookingStep
        modal.remove();
        // Убеждаемся, что шаг сохранен
        window.bookingStep = currentStep || 'select-date'
        await showBookingModal(); // Теперь showBookingModal асинхронная
    }
}

// Закрыть модальное окно
function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        console.log('🔒 Закрываем модальное окно')
        modal.remove();
        // Убеждаемся, что все модальные окна удалены (на случай дублирования)
        const allModals = document.querySelectorAll('#booking-modal, .modal-overlay[id="booking-modal"]');
        allModals.forEach(m => {
            if (m && m.parentNode) {
                m.remove();
            }
        });
    }
    window.selectedRoom = null;
    window.bookingStep = 'select-date';
    localStorage.removeItem('selectedDate');
    localStorage.removeItem('selectedTime');
    localStorage.removeItem('selectedHours');
}

async function getRoomBusySlots(roomId, date = null) {
	try {
		// Если дата не указана, берем сегодняшнюю
		if (!date) {
			date = new Date().toISOString().split('T')[0]
		}

		console.log(`📅 Загружаем занятые слоты для комнаты ${roomId} на ${date}`)

		const response = await fetch(`/api/rooms/${roomId}/busy-slots?date=${date}`)
		if (response.ok) {
			const data = await response.json()
			return data.busy_slots || []
		}
		return []
	} catch (error) {
		console.error('Ошибка загрузки расписания:', error)
		return []
	}
}

async function confirmBooking() {
	console.log('🔍 Начало подтверждения бронирования')

	// 1. Проверяем что currentUser существует
	if (!window.currentUser || !window.currentUser.telegram_id) {
		console.error('❌ Ошибка: currentUser не определен', window.currentUser)

		// Пробуем получить telegram_id из URL
		const telegramId = getTelegramIdFromUrl()
		if (telegramId) {
			console.log('🔄 Используем telegram_id из URL:', telegramId)
			window.currentUser = { telegram_id: telegramId }
		} else {
			alert(
				`❌ ${window.t ? window.t('notAuthorized') : 'Ошибка: пользователь не авторизован'}${window.t ? '. ' + window.t('reload') : '. Пожалуйста, перезагрузите страницу.'}`
			)
			return
		}
	}
// ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: не прошло ли время
    const selectedDate = localStorage.getItem('selectedDate');
    const selectedTime = localStorage.getItem('selectedTime');
    const selectedHours = parseInt(localStorage.getItem('selectedHours') || '1');
    const today = new Date().toISOString().split('T')[0];
    
    // Проверяем, что время начала бронирования еще не прошло
    const now = new Date();
    const formatted_start_time = selectedTime.includes(':')
        ? selectedTime.split(':').slice(0, 2).join(':')
        : selectedTime;
    
    // Создаем объект Date для времени начала бронирования
    let startDateTime = new Date(`${selectedDate}T${formatted_start_time}:00`);
    
    // Если выбранная дата в прошлом, это ошибка
    const selectedDateObj = new Date(selectedDate);
    const todayDateObj = new Date(today);
    todayDateObj.setHours(0, 0, 0, 0);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    console.log('🔍 Проверка даты при подтверждении:', {
        selectedDate,
        today,
        selectedDateObj: selectedDateObj.toISOString(),
        todayDateObj: todayDateObj.toISOString(),
        isPast: selectedDateObj < todayDateObj
    });
    
    if (selectedDateObj < todayDateObj) {
        console.error(`❌ Попытка забронировать прошедшую дату: ${selectedDate} (сегодня: ${today})`);
        alert(`❌ ${window.t ? window.t('pastDateError') : 'Нельзя бронировать прошедшую дату! Выбранная дата уже прошла. Пожалуйста, выберите сегодня или будущую дату.'}`);
        // Очищаем выбор и возвращаемся к выбору даты
        localStorage.removeItem('selectedDate');
        localStorage.removeItem('selectedTime');
        localStorage.removeItem('selectedHours');
        window.bookingStep = 'select-date';
        updateBookingModal();
        return;
    }
    
    // Если выбрана сегодняшняя дата, проверяем, что время начала еще не прошло
    if (selectedDate === today) {
        const startHour = parseInt(formatted_start_time.split(':')[0]);
        const startMinute = parseInt(formatted_start_time.split(':')[1] || '0');
        const startTotalMinutes = startHour * 60 + startMinute;
        
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        
        // Проверяем, что время начала еще не прошло
        // Разрешаем бронирование, если выбранное время СТРОГО больше текущего времени
        // Например, если сейчас 1:39 (99 минут), можно забронировать на 2:00 (120 минут)
        // Используем < вместо <=, чтобы можно было забронировать на следующий час
        if (startTotalMinutes < currentTotalMinutes) {
            console.error('❌ Попытка забронировать прошедшее время:', {
                selectedTime: formatted_start_time,
                startTotalMinutes,
                currentTime: `${currentHour}:${currentMinute}`,
                currentTotalMinutes,
                timeDiff: startTotalMinutes - currentTotalMinutes
            });
            alert(`❌ ${window.t ? window.t('pastTimeError') : 'Нельзя бронировать прошедшее время! Выбранное время начала уже прошло. Пожалуйста, выберите будущее время.'}`);
            return;
        }
        
        console.log('✅ Проверка времени бронирования пройдена:', {
            selectedDate,
            selectedTime: formatted_start_time,
            startTotalMinutes,
            currentTotalMinutes,
            timeDiff: startTotalMinutes - currentTotalMinutes,
            canBook: startTotalMinutes > currentTotalMinutes
        });
    } else {
        // Для будущих дат не нужно проверять время
        console.log('✅ Будущая дата, проверка времени не требуется:', {
            selectedDate,
            today,
            selectedTime: formatted_start_time
        });
    }

    
	const telegram_id = window.currentUser.telegram_id
	const room_id = window.selectedRoom?.id
	const date = localStorage.getItem('selectedDate')
	const start_time = localStorage.getItem('selectedTime')
	const hours = parseInt(localStorage.getItem('selectedHours') || '1')

	console.log('📊 Проверяем данные:', {
		telegram_id,
		room_id,
		date,
		start_time,
		hours,
		selectedRoom: window.selectedRoom,
	})

	// 2. Валидация данных
	if (!telegram_id) {
		alert(`❌ ${window.t ? window.t('notAuthorized') : 'Ошибка: пользователь не авторизован'}`)
		return
	}

	if (!room_id) {
		alert(`❌ ${window.t ? window.t('roomNotSelected') : 'Ошибка: комната не выбрана'}`)
		return
	}

	if (!date || !start_time) {
		alert(`❌ ${window.t ? window.t('selectDateAndTime') : 'Ошибка: выберите дату и время'}`)
		return
	}
	
	// Проверяем что hours валидное число
	if (isNaN(hours) || hours < 1 || hours > 24) {
		alert(`❌ ${window.t ? window.t('invalidHours') : 'Ошибка: неверное количество часов (должно быть от 1 до 24)'}`)
		return
	}

	// 3. Форматируем время (убираем секунды если есть)
	// Используем уже отформатированное время из проверки выше
	const formatted_start_time_final = start_time.includes(':')
		? start_time.split(':').slice(0, 2).join(':')
		: start_time

	// 4. Вычисляем время окончания с учетом перехода через полночь
	const startHour = parseInt(formatted_start_time_final.split(':')[0])
	const startMinute = parseInt(formatted_start_time_final.split(':')[1] || '0')
	
	// Вычисляем общее количество минут от начала дня
	const startTotalMinutes = startHour * 60 + startMinute
	const endTotalMinutes = startTotalMinutes + (hours * 60)
	
	// Вычисляем час и минуту окончания
	let endHour = Math.floor(endTotalMinutes / 60) % 24
	let endMinute = endTotalMinutes % 60
	
	// Если время окончания переходит через полночь (endHour < startHour или endTotalMinutes >= 1440)
	const crossesMidnight = endTotalMinutes >= 1440 || (endHour < startHour && endTotalMinutes > startTotalMinutes)
	
	const end_time = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
	
	console.log('🕐 Вычисление времени окончания:', {
		startHour,
		startMinute,
		hours,
		startTotalMinutes,
		endTotalMinutes,
		endHour,
		endMinute,
		crossesMidnight,
		end_time
	})

	console.log('🕐 Форматированные данные:', {
		telegram_id,
		room_id: parseInt(room_id),
		date,
		start_time: formatted_start_time_final,
		end_time,
		hours,
		price: window.selectedRoom?.price,
		total_cost: window.selectedRoom?.price
			? window.selectedRoom.price * hours
			: 'unknown',
	})

	// 5. Проверяем баланс коинов (опционально, на фронтенде)
	if (
		window.selectedRoom?.price &&
		window.userCoins < window.selectedRoom.price * hours
	) {
		const needed = window.selectedRoom.price * hours
		const missing = needed - window.userCoins
		alert(
			`💰 ${window.t ? window.t('insufficientCoinsMsg') : 'Недостаточно коинов!'}\n${window.t ? window.t('needed') : 'Нужно'}: ${needed} 🪙\n${window.t ? window.t('youHave') : 'У вас'}: ${window.userCoins} 🪙\n${window.t ? window.t('missing') : 'Не хватает'}: ${missing} 🪙`
		)
		return
	}

	// 6. Отправляем запрос на сервер
	try {
		console.log('📡 Отправляем запрос на сервер...')

		const response = await fetch('/api/bookings/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({
				telegram_id: telegram_id,
				room_id: parseInt(room_id),
				date: date,
				start_time: formatted_start_time_final,
				end_time: end_time,
			}),
		})

		console.log('📥 Ответ сервера:', response.status, response.statusText)

		// Читаем ответ даже если ошибка
		const responseText = await response.text()
		console.log('📄 Текст ответа:', responseText)

		let data
		try {
			data = JSON.parse(responseText)
		} catch (e) {
			console.error('❌ Невалидный JSON ответ:', responseText)
			throw new Error(window.t ? window.t('invalidResponse') : 'Сервер вернул невалидный ответ')
		}

		if (response.ok && data.success) {
			console.log('✅ Успех! Данные:', data)

			// Успешное бронирование
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}

			// Обновляем баланс коинов
			if (window.selectedRoom?.price) {
				window.userCoins -= window.selectedRoom.price * hours
				window.updateCoinsDisplay()
				console.log(`💰 Баланс обновлен: ${window.userCoins} 🪙`)
			}

			// Показываем уведомление с деталями
			const roomName = window.selectedRoom?.name || 'Комната'
			const cost = window.selectedRoom?.price
				? window.selectedRoom.price * hours
				: '?'

			alert(
				`✅ ${window.t ? window.t('bookingSuccessMsg') : 'Бронирование создано успешно!'}\n\n📋 ${window.t ? window.t('bookingDetails') : 'Детали'}:\n• ${window.t ? window.t('room') : 'Комната'}: ${roomName}\n• ${window.t ? window.t('date') : 'Дата'}: ${new Date(
					date
				).toLocaleDateString(
					'ru-RU'
				)}\n• ${window.t ? window.t('bookingTime') : 'Время'}: ${formatted_start_time_final} - ${end_time}\n• ${window.t ? window.t('bookingCost') : 'Стоимость'}: ${cost} 🪙\n• ${window.t ? window.t('bookingIdLabel') : 'ID брони'}: ${
					data.booking_id
				}`
			)

			// Обновляем занятые слоты для выбранной даты
			const selectedDate = localStorage.getItem('selectedDate')
			if (selectedDate && window.selectedRoom?.id) {
				await loadBusySlotsForDate(window.selectedRoom.id, selectedDate)
				console.log('✅ Занятые слоты обновлены')
			}

			// Закрываем модальное окно
			closeBookingModal()

			// Перезагружаем комнаты (чтобы обновить статусы)
			if (window.currentFloor) {
				window.loadRoomsByFloor(window.currentFloor)
			}
		} else {
			// Ошибка бронирования
			console.error('❌ Ошибка от сервера:', data)

			// Делаем ошибки более понятными для пользователя
			let userMessage = data.error || (window.t ? window.t('unknownError') : 'Неизвестная ошибка')

			if (data.error.includes('прошедшие даты') || data.error.includes('прошедшее время') || data.error.includes('прошло')) {
				userMessage = window.t ? window.t('pastDateError') : '📅 Нельзя бронировать прошедшую дату или время!\n\nПожалуйста, выберите сегодня или будущую дату и время.'
			} else if (data.error.includes('занято') || data.error.includes('уже занято')) {
				userMessage = window.t ? window.t('timeAlreadyBooked') : '⏰ Это время уже занято другим пользователем.\n\nПожалуйста, выберите другое время или другую комнату.'
			} else if (data.error.includes('Недостаточно коинов')) {
				userMessage = `💰 ${window.t ? window.t('insufficientCoinsMsg') : 'Недостаточно коинов!'}\n\n${window.t ? window.t('needed') : 'Нужно'}: ${
					window.selectedRoom?.price || '?'
				} 🪙\n${window.t ? window.t('youHave') : 'У вас'}: ${
					window.userCoins
				} 🪙\n\n${window.t ? window.t('topUpBalance') : 'Пополните баланс или выберите более дешевую комнату.'}`
			} else if (data.error.includes('Пользователь не найден')) {
				userMessage = window.t ? window.t('authErrorReload') : '👤 Ошибка авторизации.\n\nПожалуйста, перезагрузите страницу или откройте приложение через бота Telegram.'
			} else if (data.error.includes('Комната не найдена')) {
				userMessage = window.t ? window.t('roomNotFoundDetails') : '🚪 Комната не найдена.\n\nВозможно, она была удалена или деактивирована.'
			}

			// Вибрация ошибки
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('error')
			}

			// Показываем красивый alert
			alert(`❌ ${userMessage}`)
		}
	} catch (error) {
		console.error('🔥 Критическая ошибка:', error)

		// Вибрация ошибки
		if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
			Telegram.WebApp.HapticFeedback.notificationOccurred('error')
		}

		// Показываем понятное сообщение об ошибке
		let errorMessage = error.message
		if (
			error.message.includes('Failed to fetch') ||
			error.message.includes('NetworkError')
		) {
			errorMessage = window.t ? window.t('networkErrorFull') : '🌐 Ошибка сети.\n\nПроверьте подключение к интернету и попробуйте снова.'
		}

		alert(`⚠️ ${window.t ? window.t('errorPrefix') : 'Ошибка: '}${errorMessage}`)
	}
}

// Экспортируем функции для использования в основном app.js
// Экспортируем в конце файла, чтобы все функции были определены
try {
	if (typeof window !== 'undefined') {
		// Проверяем, что функции определены перед экспортом
		if (typeof openBookingModal === 'function') {
			window.openBookingModal = openBookingModal
		}
		if (typeof closeBookingModal === 'function') {
			window.closeBookingModal = closeBookingModal
		}
		if (typeof showBookingModal === 'function') {
			window.showBookingModal = showBookingModal
		}
		if (typeof updateBookingModal === 'function') {
			window.updateBookingModal = updateBookingModal
		}
		if (typeof confirmBooking === 'function') {
			window.confirmBooking = confirmBooking
		}
		if (typeof getRoomBusySlots === 'function') {
			window.getRoomBusySlots = getRoomBusySlots
		}
		if (typeof getBookingStepContent === 'function') {
			window.getBookingStepContent = getBookingStepContent
		}
		if (typeof checkIfSlotIsNow === 'function') {
			window.checkIfSlotIsNow = checkIfSlotIsNow
		}
		
		console.log('✅ Функции booking.js экспортированы в window:', {
			showBookingModal: typeof window.showBookingModal,
			openBookingModal: typeof window.openBookingModal,
			closeBookingModal: typeof window.closeBookingModal,
			updateBookingModal: typeof window.updateBookingModal,
			confirmBooking: typeof window.confirmBooking,
			getRoomBusySlots: typeof window.getRoomBusySlots
		})
	} else {
		console.error('❌ window не определен')
	}
} catch (error) {
	console.error('❌ Ошибка при экспорте функций booking.js:', error)
}