
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

// Удалены неиспользуемые функции isTimeInPast и isTimeSlotBusy
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
		localStorage.removeItem('selectedTimes')
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
    const selectedDate = localStorage.getItem('selectedDate');
    
    return `
        <div class="mb-4">
            <p class="text-gray mb-3" style="font-size: 15px; font-weight: 600;">${window.t ? window.t('selectDate') : 'Выберите дату бронирования'}</p>
            <div class="calendar-grid" id="calendar-days">
                ${days.map(day => {
					const isSelected = selectedDate === day.value
					return `
                    <button class="day-btn ${isSelected ? 'selected' : ''}" data-date="${day.value}">
                        ${day.label}
                    </button>
                `}).join('')}
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
        
        // Проверяем, был ли этот слот выбран ранее
        const selectedTimesJson = localStorage.getItem('selectedTimes');
        const selectedTimes = selectedTimesJson ? JSON.parse(selectedTimesJson) : [];
        const isSelected = selectedTimes.includes(slot.value);
        
        // Если слот был выбран ранее и не занят/не прошедший, добавляем класс selected
        if (isSelected && !isDisabled) {
            buttonClass += ' selected';
        }
        
        timeSlotsHTML += `
            <button class="${buttonClass}" data-time="${slot.value}" ${isDisabled ? 'disabled' : ''}>
                ${buttonContent}
            </button>
        `;
    });
    
    return `
        <div class="mb-4">
            <p class="text-gray mb-3" style="font-size: 15px; font-weight: 600;">${window.t ? window.t('selectTime') : 'Выберите время (можно выбрать несколько)'}</p>
            <div class="time-grid" id="time-slots">
                ${timeSlotsHTML}
            </div>
            <p class="text-gray mt-2" style="font-size: 12px; opacity: 0.7;">
                💡 ${window.t ? window.t('selectMultipleTimes') : 'Нажмите на время, чтобы выбрать. Каждый слот = 1 час'}
            </p>
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
    const selectedTimesJson = localStorage.getItem('selectedTimes');
    const selectedTimes = selectedTimesJson ? JSON.parse(selectedTimesJson) : [];
    
    if (selectedTimes.length === 0) {
        return `
            <div class="mb-4">
                <p class="text-center text-gray">${window.t ? window.t('noTimeSelected') : 'Не выбрано время'}</p>
            </div>
        `;
    }
    
    const slotsCount = selectedTimes.length;
    const totalPrice = window.selectedRoom.price * slotsCount;
    
    const date = new Date(selectedDate);
    const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
    });
    
    // Формируем список выбранных временных слотов
    const timeSlotsList = selectedTimes.map((time, index) => {
        const timeStr = time.slice(0, 5); // HH:MM
        const endHour = parseInt(timeStr.split(':')[0]) + 1;
        const endTimeStr = `${endHour.toString().padStart(2, '0')}:00`;
        return `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(59, 130, 246, 0.1);">
                <span class="text-gray">🕐 ${timeStr} - ${endTimeStr}</span>
                <span style="font-weight: 600; color: #10b981;">${window.selectedRoom.price} 🪙</span>
            </div>
        `;
    }).join('');
    
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
                    <div style="margin-top: 12px;">
                        <span class="text-gray" style="display: block; margin-bottom: 8px;">🕐 ${window.t ? window.t('selectedTimes') : 'Выбранные слоты'} (${slotsCount}):</span>
                        <div style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px;">
                            ${timeSlotsList}
                        </div>
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
			modal.querySelectorAll('.day-btn').forEach(b => {
				b.classList.remove('active', 'selected')
			})
			// Добавить активный и selected класс текущей кнопке (selected для пульсации)
			btn.classList.add('active', 'selected')

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
			
			const time = btn.dataset.time
			console.log('🕐 Клик по времени:', time)
			
			// Переключаем выбор (toggle) - если уже выбран, снимаем выбор
			if (btn.classList.contains('selected')) {
				btn.classList.remove('selected')
				console.log('❌ Снят выбор времени:', time)
			} else {
				btn.classList.add('selected')
				console.log('✅ Выбрано время:', time)
			}

			// Сохраняем массив выбранных временных слотов
			const selectedTimes = Array.from(timeSlots.querySelectorAll('.time-btn.selected:not(:disabled)'))
				.map(b => b.dataset.time)
				.sort() // Сортируем по времени
			
			// Сохраняем в localStorage как JSON массив
			localStorage.setItem('selectedTimes', JSON.stringify(selectedTimes))
			
			// Для обратной совместимости сохраняем первый выбранный слот как selectedTime
			if (selectedTimes.length > 0) {
				localStorage.setItem('selectedTime', selectedTimes[0])
			} else {
				localStorage.removeItem('selectedTime')
			}
			
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

		// Логика множественного выбора времени уже обрабатывается в timeClickHandler
	}, 100)
}

// Проверка выбора времени для активации кнопки "Далее"
function checkTimeSelection() {
    const modal = document.getElementById('booking-modal');
    const nextBtn = modal.querySelector('#next-btn');
    
    if (nextBtn) {
        const selectedTimesJson = localStorage.getItem('selectedTimes');
        const selectedTimes = selectedTimesJson ? JSON.parse(selectedTimesJson) : [];
        // Кнопка активна, если выбрано хотя бы одно время
        nextBtn.disabled = selectedTimes.length === 0;
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
    localStorage.removeItem('selectedTimes');
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
	const selectedTimesJson = localStorage.getItem('selectedTimes')
	const selectedTimes = selectedTimesJson ? JSON.parse(selectedTimesJson) : []

	console.log('📊 Проверяем данные:', {
		telegram_id,
		room_id,
		date,
		selectedTimes,
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

	if (!date || selectedTimes.length === 0) {
		alert(`❌ ${window.t ? window.t('selectDateAndTime') : 'Ошибка: выберите дату и время'}`)
		return
	}

	// 3. Проверяем баланс коинов
	const slotsCount = selectedTimes.length
	const totalPrice = window.selectedRoom.price * slotsCount
	
	if (window.selectedRoom?.price && window.userCoins < totalPrice) {
		const missing = totalPrice - window.userCoins
		alert(
			`💰 ${window.t ? window.t('insufficientCoinsMsg') : 'Недостаточно коинов!'}\n${window.t ? window.t('needed') : 'Нужно'}: ${totalPrice} 🪙\n${window.t ? window.t('youHave') : 'У вас'}: ${window.userCoins} 🪙\n${window.t ? window.t('missing') : 'Не хватает'}: ${missing} 🪙`
		)
		return
	}

	// 4. Создаем бронирования для каждого выбранного временного слота
	try {
		console.log('📡 Отправляем запросы на сервер для', slotsCount, 'слотов...')

		const bookingPromises = []
		const createdBookings = []
		const failedBookings = []

		// Для каждого временного слота создаем отдельное бронирование (1 час)
		for (const startTime of selectedTimes) {
			// Форматируем время начала
			const formatted_start_time = startTime.includes(':')
				? startTime.split(':').slice(0, 2).join(':')
				: startTime

			// Вычисляем время окончания (начало + 1 час)
			const startHour = parseInt(formatted_start_time.split(':')[0])
			const startMinute = parseInt(formatted_start_time.split(':')[1] || '0')
			const endHour = (startHour + 1) % 24
			const end_time = `${endHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`

			// Формируем тело запроса
			const requestBody = {
				room_id: parseInt(room_id),
				date: date,
				start_time: formatted_start_time,
				end_time: end_time,
			}
			
			// Приоритет: логин+телефон (для переключения профилей), иначе telegram_id
			if (window.currentUser && window.currentUser.school_login && window.currentUser.phone) {
				requestBody.school_login = window.currentUser.school_login
				requestBody.phone = window.currentUser.phone
			} else if (telegram_id) {
				requestBody.telegram_id = telegram_id
			}

			// Отправляем запрос на создание бронирования
			const promise = fetch('/api/bookings/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify(requestBody),
			}).then(async (response) => {
				const responseText = await response.text()
				let data
				try {
					data = JSON.parse(responseText)
				} catch (e) {
					throw new Error('Невалидный JSON ответ')
				}

				if (response.ok && data.success) {
					return { success: true, booking_id: data.booking_id, time: formatted_start_time }
				} else {
					throw new Error(data.error || 'Ошибка создания бронирования')
				}
			}).catch((error) => {
				return { success: false, error: error.message, time: formatted_start_time }
			})

			bookingPromises.push(promise)
		}

		// Ждем завершения всех запросов
		const results = await Promise.all(bookingPromises)

		// Разделяем успешные и неудачные бронирования
		results.forEach(result => {
			if (result.success) {
				createdBookings.push(result)
			} else {
				failedBookings.push(result)
			}
		})

		console.log('📊 Результаты бронирования:', {
			created: createdBookings.length,
			failed: failedBookings.length,
			total: slotsCount
		})

		// Успешное бронирование
		if (createdBookings.length > 0) {
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}

			// Обновляем баланс коинов с сервера
			if (typeof window.loadCoinsFromServer === 'function') {
				setTimeout(() => {
					window.loadCoinsFromServer()
				}, 300)
			} else if (window.selectedRoom?.price) {
				window.userCoins -= totalPrice
				window.updateCoinsDisplay()
			}

			// Показываем уведомление
			const roomName = window.selectedRoom?.name || 'Комната'
			let message = `✅ ${createdBookings.length} ${window.t ? window.t('bookingsCreated') : 'бронирований создано'}!\n\n📋 ${window.t ? window.t('bookingDetails') : 'Детали'}:\n• ${window.t ? window.t('room') : 'Комната'}: ${roomName}\n• ${window.t ? window.t('date') : 'Дата'}: ${new Date(date).toLocaleDateString('ru-RU')}\n• ${window.t ? window.t('slotsCount') : 'Слотов'}: ${createdBookings.length}\n• ${window.t ? window.t('bookingCost') : 'Стоимость'}: ${totalPrice} 🪙`
			
			if (failedBookings.length > 0) {
				message += `\n\n⚠️ ${failedBookings.length} ${window.t ? window.t('bookingsFailed') : 'бронирований не удалось создать'}`
			}

			// Запускаем confetti при успешном бронировании
			if (createdBookings.length > 0) {
				createConfetti()
			}

			alert(message)

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

			// Обновляем список бронирований, если пользователь находится на экране "Мои бронирования"
			// Используем refreshBookingsList для обновления без переключения экрана
			if (typeof refreshBookingsList === 'function') {
				// Вызываем с небольшой задержкой, чтобы сервер успел обработать запрос
				setTimeout(() => {
					refreshBookingsList()
				}, 500)
			} else if (typeof window.refreshBookingsList === 'function') {
				setTimeout(() => {
					window.refreshBookingsList()
				}, 500)
			} else if (typeof loadMyBookings === 'function') {
				// Fallback: если refreshBookingsList недоступна, используем loadMyBookings
				setTimeout(() => {
					loadMyBookings()
					console.log('✅ Список бронирований обновлен (через loadMyBookings)')
				}, 500)
			} else if (typeof window.loadMyBookings === 'function') {
				setTimeout(() => {
					window.loadMyBookings()
					console.log('✅ Список бронирований обновлен (через window.loadMyBookings)')
				}, 500)
			}
		} else {
			// Ошибка бронирования - все слоты не удалось создать
			console.error('❌ Ошибка: не удалось создать ни одного бронирования')
			
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('error')
			}
			
			alert(`❌ ${window.t ? window.t('bookingFailed') : 'Не удалось создать бронирования'}\n\n${window.t ? window.t('tryAgain') : 'Попробуйте еще раз или выберите другое время.'}`)
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

// Функция для создания confetti при успешном бронировании
function createConfetti() {
	const container = document.createElement('div')
	container.className = 'confetti-container'
	document.body.appendChild(container)

	// Создаем 50 частиц конфетти
	for (let i = 0; i < 50; i++) {
		const confetti = document.createElement('div')
		confetti.className = 'confetti'
		confetti.style.left = Math.random() * 100 + '%'
		confetti.style.animationDuration = (Math.random() * 2 + 2) + 's'
		confetti.style.animationDelay = Math.random() * 0.5 + 's'
		container.appendChild(confetti)
	}

	// Удаляем контейнер после завершения анимации
	setTimeout(() => {
		container.remove()
	}, 3000)
}

// Экспортируем функцию confetti
if (typeof window !== 'undefined') {
	window.createConfetti = createConfetti
}