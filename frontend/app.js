// frontend/app.js
let currentUser = null
let userCoins = 100
let allRooms = []
let currentFloor = null
window.selectedRoom = null
window.bookingStep = 'select-date'
console.log('👤 Текущий пользователь при запуске:', currentUser)

// Получить telegram_id из URL параметра startapp
function getTelegramIdFromUrl() {
	const urlParams = new URLSearchParams(window.location.search)
	const startappParam = urlParams.get('startapp')

	if (startappParam) {
		console.log('📱 Telegram ID из URL:', startappParam)
		const id = parseInt(startappParam)
		return isNaN(id) ? null : id
	}

	// Пробуем получить из Telegram Web App
	if (Telegram?.WebApp?.initDataUnsafe?.user?.id) {
		console.log(
			'📱 Telegram ID из WebApp:',
			Telegram.WebApp.initDataUnsafe.user.id
		)
		return Telegram.WebApp.initDataUnsafe.user.id
	}

	// Для тестирования в браузере - используем тестовый ID
	console.log('🌐 Режим браузера - используем тестовый ID')
	return 123456789 // Тестовый ID для браузера
}

// Маска ввода для узбекского телефона (+998-00-000-00-00)
function setupPhoneMask() {
	const phoneInput = document.getElementById('phone')
	if (!phoneInput) return

	phoneInput.addEventListener('input', function(e) {
		let inputValue = e.target.value
		
		// Если номер уже в правильном формате, не форматируем повторно
		const correctPattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
		if (correctPattern.test(inputValue)) {
			return // Уже правильно отформатирован
		}
		
		let value = inputValue.replace(/\D/g, '') // Убираем все нецифровые символы
		
		// Если начинается не с 998, добавляем 998
		if (value.length > 0 && !value.startsWith('998')) {
			value = '998' + value
		}
		
		// Ограничиваем до 12 цифр (998 + 9 цифр)
		if (value.length > 12) {
			value = value.substring(0, 12)
		}
		
		// Форматируем: +998-00-000-00-00
		let formatted = '+998'
		if (value.length > 3) {
			formatted += '-' + value.substring(3, 5) // 2 цифры
		}
		if (value.length > 5) {
			formatted += '-' + value.substring(5, 8) // 3 цифры
		}
		if (value.length > 8) {
			formatted += '-' + value.substring(8, 10) // 2 цифры
		}
		if (value.length > 10) {
			formatted += '-' + value.substring(10, 12) // 2 цифры
		}
		
		// Обновляем только если значение изменилось
		if (e.target.value !== formatted) {
			e.target.value = formatted
		}
	})

	// При фокусе, если поле пустое, добавляем +998-
	phoneInput.addEventListener('focus', function(e) {
		if (!e.target.value) {
			e.target.value = '+998-'
		}
	})
}

// Инициализация приложения
async function initApp() {
	console.log('🚀 initApp запущен')

	// Проверяем открыто ли в Telegram или браузере
	const isTelegram = typeof Telegram !== 'undefined' && Telegram.WebApp
	console.log('📱 Открыто в:', isTelegram ? 'Telegram' : 'Браузере')

	if (isTelegram) {
		// Telegram Web App режим
		Telegram.WebApp.ready()
		Telegram.WebApp.expand()
	} else {
		// Браузер режим - добавляем эмуляцию
		console.log('🌐 Браузерный режим - эмулируем Telegram WebApp')
		window.Telegram = {
			WebApp: {
				ready: () => console.log('Telegram ready (mock)'),
				expand: () => console.log('Telegram expand (mock)'),
				initDataUnsafe: {
					user: {
						id: 123456789,
						first_name: window.t ? window.t('testUser') : 'Тестовый',
						username: 'test_user',
						language_code: 'ru',
					},
				},
				HapticFeedback: {
					notificationOccurred: type => console.log('Haptic:', type),
				},
			},
		}
	}

	// Настраиваем маску для телефона
	setupPhoneMask()

	// Получаем telegram_id (работает и в Telegram и в браузере)
	const telegramId = getTelegramIdFromUrl()

	if (!telegramId) {
		console.warn('⚠️ Не удалось получить telegram_id')
		showFloorsScreen()
		return
	}

	// Получаем данные пользователя
	const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
		id: telegramId,
		first_name: window.t ? window.t('user') : 'Пользователь',
		username: 'user_' + telegramId,
	}

	console.log('👤 Пользователь:', tgUser)

	try {
		// Аутентифицируем пользователя на бэкенде
		console.log('📡 Отправляем запрос на /api/auth')
		const response = await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: telegramId,
			}),
		})

		console.log('📥 Ответ получен:', response.status)
		const data = await response.json()
		console.log('📊 Данные от сервера:', data)

		if (data.success) {
			currentUser = data.user
			userCoins = data.user.coins || 0
			// Синхронизируем с window для booking.js
			window.userCoins = userCoins

			updateUserInfo(tgUser)
			updateCoinsDisplay()

			console.log('✅ Текущий пользователь установлен:', currentUser)

			// Показываем экран регистрации, если пользователь новый или не заполнил обязательные поля
			if (data.user.is_new || !data.user.school_login || !data.user.phone) {
				console.log('📝 Показываем экран регистрации')
				showScreen('registration')
			} else {
				console.log('🏢 Показываем экран выбора этажа')
				loadAllRooms()
			}
		} else {
			showScreen(
				'error',
				(window.t ? window.t('authErrorPrefix') : 'Ошибка авторизации: ') + (data.error || (window.t ? window.t('unknownError') : 'неизвестная ошибка'))
			)
		}
	} catch (error) {
		console.error('❌ Auth error:', error)
		showScreen('error', (window.t ? window.t('connectionError') : 'Ошибка соединения с сервером') + ': ' + error.message)
	}
}

// Обновление информации о пользователе
function updateUserInfo(tgUser) {
	const userInfo = document.getElementById('user-info')
	const userInfoFloor = document.getElementById('user-info-floor')
	const userInfoReg = document.getElementById('user-info-reg')

	// Используем school_login из currentUser, если он заполнен, иначе используем username из Telegram
	let displayName = tgUser.first_name || (window.t ? window.t('user') : 'Пользователь')
	let displayUsername = ''
	
	if (currentUser && currentUser.school_login) {
		// Если есть school_login, показываем его вместо username
		displayUsername = `(${currentUser.school_login})`
	} else if (tgUser.username) {
		// Иначе показываем username из Telegram
		displayUsername = `(@${tgUser.username})`
	}

	const userHtml = `
        <strong>${displayName}</strong>
        ${displayUsername}
    `

	if (userInfo) {
		userInfo.innerHTML = userHtml
		// Убираем класс loading-dots когда данные загружены
		userInfo.classList.remove('loading-dots')
	}
	if (userInfoFloor) {
		userInfoFloor.innerHTML = userHtml
		// Убираем класс loading-dots когда данные загружены
		userInfoFloor.classList.remove('loading-dots')
	}
	if (userInfoReg) {
		userInfoReg.innerHTML = userHtml
		// Убираем класс loading-dots когда данные загружены
		userInfoReg.classList.remove('loading-dots')
	}
}

// Обновление отображения коинов
function updateCoinsDisplay() {
	const coinsElement = document.getElementById('user-coins')
	const coinsElementFloor = document.getElementById('user-coins-floor')

	const coinsValue = window.userCoins || userCoins || 0
	// Синхронизируем значения для booking.js
	if (userCoins !== undefined && userCoins !== null) {
		window.userCoins = userCoins
	}

	if (coinsElement) coinsElement.textContent = `🪙 ${coinsValue}`
	if (coinsElementFloor) coinsElementFloor.textContent = `🪙 ${coinsValue}`
}

// Показать определенный экран
// Функция для открытия экрана регистрации (для редактирования профиля)
function showRegistrationScreen() {
	console.log('📝 Открываем экран регистрации для редактирования профиля')
	
	// Загружаем текущие данные пользователя в форму
	if (currentUser) {
		const schoolLoginInput = document.getElementById('school-login')
		const phoneInput = document.getElementById('phone')
		
		if (schoolLoginInput && currentUser.school_login) {
			schoolLoginInput.value = currentUser.school_login
		}
		if (phoneInput && currentUser.phone) {
			phoneInput.value = currentUser.phone
		}
	}
	
	// Настраиваем маску для телефона
	setupPhoneMask()
	
	// Показываем экран регистрации
	showScreen('registration')
}

// Экспортируем функцию в window для доступа из консоли
window.showRegistrationScreen = showRegistrationScreen

// Функция переключения языка
function toggleLanguage() {
	const newLang = currentLanguage === 'ru' ? 'uz' : 'ru'
	setLanguage(newLang)
	
	// Обновляем индикатор языка
	const langIndicator = document.getElementById('lang-indicator')
	if (langIndicator) {
		langIndicator.textContent = newLang.toUpperCase()
	}
}

window.toggleLanguage = toggleLanguage

function showScreen(screenId, message = '') {
	console.log(`🖥️ Показываем экран: ${screenId}`)

	// Скрыть все экраны
	const screens = ['floors', 'main', 'registration', 'bookings', 'error']
	screens.forEach(screen => {
		const element = document.getElementById(`${screen}-screen`)
		if (element) element.style.display = 'none'
	})

	// Показать нужный экран
	const targetScreen = document.getElementById(`${screenId}-screen`)
	if (targetScreen) {
		targetScreen.style.display = 'block'
		
		// Скрыть/показать навигационную панель в зависимости от экрана
		const navBar = document.querySelector('.nav-bar')
		if (navBar) {
			// Скрываем навигацию на экране регистрации и ошибки
			if (screenId === 'registration' || screenId === 'error') {
				navBar.style.display = 'none'
			} else {
				navBar.style.display = 'flex'
			}
		}
		
		// Если показываем экран регистрации, настраиваем маску телефона
		if (screenId === 'registration') {
			setTimeout(() => setupPhoneMask(), 100) // Небольшая задержка для гарантии, что элемент существует
		}
	}

	if (message && screenId === 'error') {
		const errorMsg = document.getElementById('error-message')
		if (errorMsg) errorMsg.textContent = message
	}
}

// Загрузить все комнаты
async function loadAllRooms() {
	try {
		console.log('📥 Загружаем все комнаты...')
		const response = await fetch('/api/rooms')
		const data = await response.json()

		if (data.success) {
			allRooms = data.rooms
			console.log(`✅ Загружено ${allRooms.length} комнат`)
			showFloorsScreen()
		}
	} catch (error) {
		console.error('❌ Error loading rooms:', error)
	}
}

// Загрузить комнаты по этажу
async function loadRoomsByFloor(floorNumber) {
	try {
		console.log(`📥 Загружаем комнаты для этажа ${floorNumber}...`)
		const response = await fetch(`/api/rooms/floor/${floorNumber}`)
		const data = await response.json()

		if (data.success) {
			// Обновляем allRooms для текущего этажа
			allRooms = data.rooms
			console.log(`✅ Загружено ${allRooms.length} комнат для этажа ${floorNumber}`)
			
			// Загружаем текущий статус занятости и отображаем комнаты
			await loadAndDisplayRoomsWithStatus(floorNumber, data.rooms)
		}
	} catch (error) {
		console.error('❌ Error loading rooms by floor:', error)
	}
}

// Загрузить текущий статус занятости комнат и отобразить их
async function loadAndDisplayRoomsWithStatus(floorNumber, rooms) {
	try {
		// Загружаем текущий статус занятости
		const statusResponse = await fetch(`/api/rooms/floor/${floorNumber}/current-status`)
		const statusData = await statusResponse.json()
		
		if (statusData.success) {
			// Обновляем статус занятости для каждой комнаты
			const roomsWithStatus = rooms.map(room => {
				const isBusyNow = statusData.busy_rooms[room.id] === true
				return {
					...room,
					isBusyNow: isBusyNow
				}
			})
			
			console.log('📊 Статус занятости комнат:', statusData.busy_rooms)
			displayRooms(roomsWithStatus)
			
			// Запускаем периодическое обновление статуса (каждые 10 секунд)
			startRoomStatusPolling(floorNumber)
		} else {
			// Если не удалось загрузить статус, отображаем без него
			displayRooms(rooms)
		}
	} catch (error) {
		console.error('❌ Error loading room status:', error)
		// В случае ошибки отображаем комнаты без статуса
		displayRooms(rooms)
	}
}

// Переменная для хранения интервала обновления статуса
let roomStatusPollingInterval = null

// Запустить периодическое обновление статуса комнат
function startRoomStatusPolling(floorNumber) {
	// Останавливаем предыдущий интервал, если он был
	if (roomStatusPollingInterval) {
		clearInterval(roomStatusPollingInterval)
	}
	
	// Обновляем статус каждые 10 секунд
	roomStatusPollingInterval = setInterval(async () => {
		if (currentFloor === floorNumber) {
			try {
				const statusResponse = await fetch(`/api/rooms/floor/${floorNumber}/current-status`)
				const statusData = await statusResponse.json()
				
				if (statusData.success) {
					// Обновляем статус занятости для каждой комнаты
					const roomsWithStatus = allRooms.map(room => {
						const isBusyNow = statusData.busy_rooms[room.id] === true
						return {
							...room,
							isBusyNow: isBusyNow
						}
					})
					
					// Обновляем отображение только если статус изменился
					updateRoomStatuses(roomsWithStatus)
				}
			} catch (error) {
				console.error('❌ Error updating room status:', error)
			}
		} else {
			// Если перешли на другой этаж, останавливаем обновление
			clearInterval(roomStatusPollingInterval)
			roomStatusPollingInterval = null
		}
	}, 10000) // 10 секунд
}

// Обновить статусы комнат без полной перерисовки
function updateRoomStatuses(roomsWithStatus) {
	roomsWithStatus.forEach(room => {
		const roomCard = document.querySelector(`.room-card[data-room-id="${room.id}"]`)
		if (roomCard) {
			const statusElement = roomCard.querySelector('.room-status')
			const busyBadge = roomCard.querySelector('[style*="Занята сейчас"]')
			
			if (room.isBusyNow) {
				// Комната занята - обновляем на красный статус
				if (statusElement) {
					statusElement.className = 'room-status status-busy'
					statusElement.textContent = t('busyNow')
				}
				
				// Добавляем бейдж "Занята сейчас" если его нет
				if (!busyBadge) {
					const roomImage = roomCard.querySelector('.room-image')
					if (roomImage) {
						const badge = document.createElement('div')
						badge.style.cssText = 'position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.95); backdrop-filter: blur(10px); color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.3);'
						badge.textContent = '🔴 Занята сейчас'
						roomImage.appendChild(badge)
					}
				}
				
				// Комната остается кликабельной - можно забронировать на будущее
				// Не блокируем клик, только показываем статус
				// Убеждаемся, что комната остается кликабельной
				const canBook = userCoins >= room.price
				if (canBook) {
					roomCard.setAttribute('data-can-book', 'true')
					roomCard.setAttribute('data-room-id', room.id)
					roomCard.style.cursor = 'pointer'
					roomCard.style.opacity = '1'
					roomCard.onclick = () => openBookingModalById(room.id)
				}
			} else {
				// Комната свободна - обновляем на зеленый статус
				if (statusElement) {
					statusElement.className = 'room-status status-free'
					statusElement.textContent = t('available')
				}
				
				// Удаляем бейдж "Занята сейчас"
				if (busyBadge) {
					busyBadge.remove()
				}
				
				// Делаем карточку доступной для клика
				const canBook = userCoins >= room.price
				if (canBook) {
					roomCard.setAttribute('data-can-book', 'true')
					roomCard.setAttribute('data-room-id', room.id)
					roomCard.style.cursor = 'pointer'
					roomCard.style.opacity = '1'
					roomCard.onclick = () => openBookingModalById(room.id)
				}
			}
		}
	})
}

// Показать экран выбора этажа
function showFloorsScreen() {
	// Проверяем, что пользователь зарегистрирован
	if (!currentUser || !currentUser.school_login || !currentUser.phone) {
		// Если пользователь не зарегистрирован, показываем экран регистрации
		showScreen('registration')
		return
	}

	console.log('🏢 Показываем экран выбора этажа')

	// Обновляем информацию пользователя
	const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
		first_name: window.t ? window.t('user') : 'Пользователь',
		username: '',
	}
	updateUserInfo(tgUser)
	updateCoinsDisplay()

	showScreen('floors')
}

// Выбрать этаж
function selectFloor(floorNumber) {
	console.log(`🏢 Выбран этаж: ${floorNumber}`)
	currentFloor = floorNumber

	// Обновляем заголовок
	const floorTitle = document.getElementById('floor-title')
	if (floorTitle) {
		// Используем только номер этажа и слово "Этаж", без дублирования
		const floorText = window.t ? window.t('floor') : 'Этаж'
		floorTitle.textContent = `🏢 ${floorNumber} ${floorText}`
	}

	// Загружаем комнаты этого этажа
	loadRoomsByFloor(floorNumber)
	showScreen('main')
}

// Инициализация обработчика кликов для комнат
function initRoomsClickHandler() {
	const container = document.getElementById('rooms-container')
	if (!container) {
		console.error('❌ Контейнер rooms-container не найден')
		return
	}
	
	// Удаляем старый обработчик, если он был
	// Создаем новый обработчик каждый раз, чтобы он работал после innerHTML
	const newHandler = (e) => {
		// Находим ближайшую карточку комнаты
		const card = e.target.closest('.room-card[data-can-book="true"]')
		if (card) {
			e.preventDefault()
			e.stopPropagation()
			const roomId = parseInt(card.getAttribute('data-room-id'))
			console.log(`🖱️ Клик по карточке! roomId: ${roomId}, card:`, card)
			if (roomId && !isNaN(roomId)) {
				console.log(`✅ Открываем модальное окно для комнаты ID: ${roomId}`)
				openBookingModalById(roomId)
			} else {
				console.error('❌ Не удалось получить ID комнаты из карточки', {
					roomId,
					card,
					attributes: Array.from(card.attributes).map(attr => ({ name: attr.name, value: attr.value }))
				})
			}
		} else {
			// Логируем, что было кликнуто, для отладки
			console.log('🖱️ Клик не по карточке комнаты:', e.target)
		}
	}
	
	// Удаляем все предыдущие обработчики и добавляем новый
	container.removeEventListener('click', container._roomsClickHandler)
	container._roomsClickHandler = newHandler
	container.addEventListener('click', newHandler)
	
	console.log('✅ Обработчик кликов для комнат инициализирован')
}

// Отображение комнат
function displayRooms(rooms) {
	const container = document.getElementById('rooms-container')
	if (!container) {
		console.error('❌ Не найден rooms-container')
		return
	}

	console.log(`🎨 Отображаем ${rooms.length} комнат`)

	if (rooms.length === 0) {
		container.innerHTML =
			`<div class="card text-center"><p class="text-gray">${window.t ? window.t('noRooms') : 'Нет комнат на этом этаже'}</p></div>`
		return
	}

	let html = ''

	// Разделяем комнаты по типам
	const skypboxes = rooms.filter(r => r.type === 'skypbox')
	const meetingRooms = rooms.filter(r => r.type === 'meeting')

	// Скайпницы
	if (skypboxes.length > 0) {
		html += '<div class="mb-6">'

		// Заголовок только если есть оба типа комнат
		if (meetingRooms.length > 0) {
			html += `<h3 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">🎧 ${window.t ? window.t('skypboxes') : 'Скайпницы'}</h3>`
		}

		skypboxes.forEach(room => {
			const canBook = userCoins >= room.price
			const isBusyNow = room.isBusyNow || false
			html += createRoomCard(room, canBook, isBusyNow)
		})

		html += '</div>'
	}

	// Переговорки
	if (meetingRooms.length > 0) {
		html +=
			`<div class="mb-6"><h3 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #0f172a;">👥 ${window.t ? window.t('meetingRooms') : 'Переговорные комнаты'}</h3>`

		meetingRooms.forEach(room => {
			const canBook = userCoins >= room.price
			const isBusyNow = room.isBusyNow || false
			html += createRoomCard(room, canBook, isBusyNow)
		})

		html += '</div>'
	}

	container.innerHTML = html
	
	// Убираем класс loading-dots когда загрузка завершена
	const loadingElement = container.querySelector('.loading-dots')
	if (loadingElement) loadingElement.classList.remove('loading-dots')
	
	// Инициализируем обработчик кликов (только один раз)
	initRoomsClickHandler()
	
	// Логируем количество доступных карточек
	setTimeout(() => {
		const clickableCards = document.querySelectorAll('.room-card[data-can-book="true"]')
		console.log(`✅ Найдено ${clickableCards.length} доступных для бронирования комнат`)
		clickableCards.forEach(card => {
			const roomId = parseInt(card.getAttribute('data-room-id'))
			console.log(`  - Комната ID: ${roomId}, элемент:`, card)
		})
	}, 100)
}

// Функция для перевода названия комнаты
function translateRoomName(roomName) {
	if (!window.t) return roomName
	// Переводим названия комнат
	const translations = {
		'Скайпница 1': window.t('skypbox1'),
		'Скайпница 2': window.t('skypbox2'),
		'Скайпница 3': window.t('skypbox3'),
		'Скайпница 4': window.t('skypbox4'),
		'Скайпница 5': window.t('skypbox5'),
		'Скайпница 6': window.t('skypbox6'),
		'Переговорка 1': window.t('meeting1'),
		'Переговорка 2': window.t('meeting2'),
		'Переговорка 3': window.t('meeting3'),
	}
	return translations[roomName] || roomName
}

// Функция для перевода описания комнаты
function translateDescription(desc) {
	if (!window.t) return desc
	let translated = desc
	// Заменяем ключевые фразы на переводы
	translated = translated.replace(/Вместимость 4 человека/g, window.t('capacity4'))
	translated = translated.replace(/Вместимость до 8 человек/g, window.t('capacity8'))
	translated = translated.replace(/Полная шумоизоляция/g, window.t('fullSoundproofing'))
	translated = translated.replace(/Комфортная переговорная комната/g, window.t('comfortableMeeting'))
	translated = translated.replace(/Проектор и доска для презентаций/g, window.t('projectorBoard'))
	translated = translated.replace(/Идеально для встреч и обсуждений/g, window.t('idealForMeetings'))
	translated = translated.replace(/Идеальна для созвонов и работы в тишине/g, window.t('idealForCalls'))
	translated = translated.replace(/Комфортное кресло и стол/g, window.t('comfortableChair'))
	translated = translated.replace(/Для важных звонков и фокусировки/g, window.t('importantCalls'))
	translated = translated.replace(/Оснащена розетками и USB/g, window.t('equippedOutlets'))
	translated = translated.replace(/Уединенное пространство для работы/g, window.t('privateSpace'))
	translated = translated.replace(/Хорошее освещение и вентиляция/g, window.t('goodLighting'))
	translated = translated.replace(/Тихая зона для работы/g, window.t('quietZone'))
	translated = translated.replace(/Стандартная кабинка на 3 этаже/g, window.t('standardBooth'))
	translated = translated.replace(/Уютная рабочая зона/g, window.t('cozyWorkArea'))
	translated = translated.replace(/Для индивидуальной работы/g, window.t('individualWork'))
	translated = translated.replace(/Изолированное пространство/g, window.t('isolatedSpace'))
	translated = translated.replace(/Идеально для интервью/g, window.t('idealForInterviews'))
	translated = translated.replace(/Комфортная кабинка/g, window.t('comfortableBooth'))
	translated = translated.replace(/Тихая рабочая зона/g, window.t('quietWorkZone'))
	return translated
}

function createRoomCard(room, canBook, isBusyNow = false) {
	// Определяем, можно ли бронировать комнату
	// Комната всегда кликабельна, даже если занята сейчас (можно забронировать на будущее)
	const canBookRoom = canBook
	
	// Используем data-атрибут для хранения ID комнаты
	const roomId = parseInt(room.id)
	
	// Убеждаемся, что ID валидный
	if (isNaN(roomId)) {
		console.error(`❌ Неверный ID комнаты: ${room.id} для комнаты ${room.name}`)
	}
	
	// Комната всегда кликабельна (можно забронировать на будущее время)
	const canBookAttr = canBookRoom
		? `data-room-id="${roomId}" data-can-book="true" style="cursor: pointer;" onclick="openBookingModalById(${roomId}); return false;"`
		: 'style="cursor: not-allowed; opacity: 0.6;"'
	
	console.log(`🏠 Создаем карточку комнаты: ${room.name}, canBook: ${canBook}, isBusyNow: ${isBusyNow}, canBookRoom: ${canBookRoom}, ID: ${roomId}`)

	// Статус отображается, но не блокирует бронирование
	const statusText = isBusyNow
		? t('busyNow')
		: canBook
		? t('available')
		: t('insufficientCoins')

	const statusClass = isBusyNow
		? 'status-busy'
		: canBook
		? 'status-free'
		: 'status-busy'

	// Определяем изображение комнаты по типу
	const roomImagePath = room.type === 'skypbox' 
		? 'assets/skype_room.jpg'  // Все скайпницы используют это фото
		: 'assets/meeting_room.jpg' // Все переговорки используют это фото
	
	// Иконки для типа комнаты (запасной вариант если нет фото)
	const roomIcon = room.type === 'skypbox' 
		? '<i class="fas fa-phone" style="font-size: 80px; color: white; opacity: 0.9;"></i>' 
		: '<i class="fas fa-users" style="font-size: 80px; color: white; opacity: 0.9;"></i>'

	// Форматируем цену
	const priceDisplay = room.price === 0 ? '🆓 Бесплатно' : `🪙 ${room.price}`

	// Первые 2 строки описания
	const descLines = translateDescription(room.description).split('\n').slice(0, 2).join(' • ')

	// Убеждаемся, что класс и атрибуты правильно установлены
	const cardClass = canBookRoom ? 'room-card' : 'room-card disabled'
	
	return `
        <div class="${cardClass}" ${canBookAttr}>
            <div class="room-image room-photo-${room.id}" style="background-image: url('${roomImagePath}'); background-size: cover; background-position: center;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%);"></div>
                <div class="room-icon-fallback" style="position: relative; z-index: 2; display: none;">
					${roomIcon}
				</div>
                ${
									isBusyNow
										? `
                    <div style="position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.95); backdrop-filter: blur(10px); color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.3);">
                        ${t('busyNowBadge')}
                    </div>
                `
										: ''
								}
            </div>
            
            <div class="room-header">
                <div>
                    <div class="room-name">${translateRoomName(room.name)}</div>
                    <div class="text-gray" style="font-size: 13px; margin-top: 4px;">
                        <i class="fas fa-users" style="font-size: 11px;"></i> ${t('upTo')} ${room.max_persons} ${t('persons')} • 
                        <i class="fas fa-building" style="font-size: 11px;"></i> ${room.floor} ${t('floor')}
                    </div>
                </div>
                <div class="room-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
            
            <p class="text-gray mb-3" style="line-height: 1.6; font-size: 13px; padding: 0 20px;">${descLines}</p>
            
            ${
							room.busySlots && room.busySlots.length > 0
								? `
                <div style="margin: 0 20px 12px; padding: 12px; background: rgba(239, 68, 68, 0.08); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.15);">
                    <p class="text-gray" style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: #dc2626;">${t('busyToday')}</p>
                    ${room.busySlots
											.map(
												slot => `
                        <div style="font-size: 12px; color: #64748b; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span>🕐 ${slot.start_time} - ${slot.end_time}</span>
                            ${
															checkIfSlotIsNow([slot])
																? `<span style="color:#dc2626; font-weight: 600; font-size: 11px;">• ${window.t ? window.t('now') : 'Сейчас'}</span>`
																: ''
														}
                        </div>
                    `
											)
											.join('')}
                </div>
            `
								: ''
						}
            
            <div class="room-details">
                <div class="text-gray">
                    <i class="fas fa-clock" style="font-size: 13px;"></i> ${room.price === 0 ? (window.t ? window.t('free') : 'Бесплатно') : `${room.price} 🪙/${window.t ? window.t('hour') : 'час'}`}
                </div>
                <div class="room-price">
                    ${priceDisplay}
                </div>
            </div>
        </div>
    `
}

// Новая функция для проверки занятости комнаты
function checkIfRoomIsBusyNow(room) {
	// Пока просто заглушка - в реальности нужно запрашивать API
	// TODO: Реализовать проверку через API
	return false
}

// Обработка регистрации
async function registerUser() {
	const schoolLogin = document.getElementById('school-login').value.trim()
	const phone = document.getElementById('phone').value.trim()

	// Валидация обязательных полей
	if (!schoolLogin) {
		alert(window.t ? window.t('enterSchoolLogin') : 'Введите школьный логин!')
		return
	}

	if (!phone) {
		alert(window.t ? window.t('enterPhoneNumber') : 'Введите номер телефона!')
		return
	}

	// Валидация формата телефона (узбекский формат: +998-XX-XXX-XX-XX)
	const phonePattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
	if (!phonePattern.test(phone)) {
		console.error('Валидация телефона не прошла:', phone)
		console.error('Паттерн:', phonePattern)
		console.error('Результат теста:', phonePattern.test(phone))
		alert(window.t ? window.t('invalidPhoneFormat') : 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)')
		return
	}

	try {
		const response = await fetch('/api/profile/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: currentUser.telegram_id,
				school_login: schoolLogin,
				phone: phone,
			}),
		})

		const data = await response.json()

		if (data.success) {
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}

			// Обновляем информацию о пользователе
			currentUser.school_login = schoolLogin
			currentUser.phone = phone

			// Обновляем отображение информации о пользователе с новым логином
			const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
				first_name: window.t ? window.t('user') : 'Пользователь',
				username: '',
			}
			updateUserInfo(tgUser)

			showFloorsScreen()
			loadAllRooms()
		} else {
			console.error('Ошибка регистрации:', data.error)
			console.error('Введенный телефон:', phone)
			alert((window.t ? window.t('errorPrefix') : 'Ошибка: ') + data.error)
		}
	} catch (error) {
		alert(window.t ? window.t('networkError') : 'Ошибка сети')
		console.error(error)
	}
}

// Загрузка моих бронирований (ИСПРАВЛЕНО: теперь POST запрос)
async function loadMyBookings() {
	if (!currentUser || !currentUser.telegram_id) {
		console.error('❌ Нет текущего пользователя')
		return
	}

	try {
		const response = await fetch('/api/my-bookings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: currentUser.telegram_id,
			}),
		})
		const data = await response.json()

		if (data.success) {
			displayBookings(data.bookings)
			showScreen('bookings')
		} else {
			console.error('Ошибка загрузки бронирований:', data.error)
		}
	} catch (error) {
		console.error('❌ Error loading bookings:', error)
	}
}

// Отображение бронирований
function displayBookings(bookings) {
	const container = document.getElementById('bookings-container')
	if (!container) {
		console.error('❌ Не найден bookings-container')
		return
	}

	if (bookings.length === 0) {
		container.innerHTML =
			`<div class="card text-center" style="padding: 48px 24px;"><p class="text-gray" style="font-size: 15px;">${t('noBookings')}</p></div>`
		return
	}

	let html = '<div class="space-y-4">'

	bookings.forEach((booking, index) => {
		const date = new Date(booking.date)
		const locale = window.currentLanguage === 'uz' ? 'uz-UZ' : 'ru-RU'
		const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
		
		// Проверяем, переходит ли бронирование через полночь
		const startTime = booking.start_time.split(':').slice(0, 2).join(':') // Убираем секунды если есть
		const endTime = booking.end_time.split(':').slice(0, 2).join(':') // Убираем секунды если есть
		const crossesMidnight = booking.crosses_midnight || endTime < startTime
		const isContinuation = booking.is_continuation || false
		
		// Если это продолжение бронирования с предыдущего дня, показываем по-другому
		if (isContinuation) {
			const prevDate = new Date(date)
			prevDate.setDate(prevDate.getDate() - 1)
			const prevDateStr = prevDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
			timeDisplay = `🕐 ${startTime} (${prevDateStr}) - ${endTime} (${dateStr})`
		} else if (crossesMidnight) {
			// Если переходит через полночь, показываем дату окончания
			const endDate = new Date(date)
			endDate.setDate(endDate.getDate() + 1)
			const endDateStr = endDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
			timeDisplay = `🕐 ${startTime} (${dateStr}) - ${endTime} (${endDateStr})`
		} else {
			// Обычное бронирование без перехода через полночь
			timeDisplay = `🕐 ${startTime} - ${endTime}`
		}

		// Проверяем, можно ли отменить бронирование (должно быть больше 1 часа до начала)
		const canCancel = checkIfCanCancelBooking(booking.date, booking.start_time)
		
		html += `
            <div class="card booking-card" data-booking-id="${booking.id}">
                <div class="room-header mb-3">
                    <div>
                        <h4 class="room-name">${translateRoomName(booking.room_name)}</h4>
                        <p class="text-gray" style="font-size: 13px; margin-top: 4px;">
                            📅 ${dateStr}<br>
                            ${timeDisplay}
                        </p>
                    </div>
                    <span class="room-status ${
											booking.status === 'confirmed'
												? 'status-free'
												: 'status-busy'
										}">
                        ${
													booking.status === 'confirmed'
														? t('confirmed')
														: booking.status === 'cancelled'
														? t('cancelled')
														: booking.status
												}
                    </span>
                </div>
                
                <div class="room-details">
                    <div class="text-gray">
                        <i class="fas fa-coins"></i> ${booking.price} 🪙
                    </div>
                    <div class="text-gray" style="font-size: 12px;">
                        ID: #${booking.id.toString().padStart(4, '0')}
                    </div>
                </div>
                
                ${
									booking.status === 'confirmed' && canCancel
										? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(59, 130, 246, 0.2);">
                        <button 
                            class="btn btn-secondary" 
                            onclick="cancelBooking(${booking.id})"
                            style="width: 100%; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #dc2626;"
                        >
                            <i class="fas fa-times"></i> ${t('cancelBooking')}
                        </button>
                    </div>
                `
										: booking.status === 'confirmed' && !canCancel
										? `
                    <div style="margin-top: 16px; padding: 12px; background: rgba(100, 116, 139, 0.1); border-radius: 12px; border: 1px solid rgba(100, 116, 139, 0.2);">
                        <p class="text-gray" style="font-size: 12px; text-align: center; color: #94a3b8;">
                            <i class="fas fa-info-circle"></i> ${t('cancelInfo')}
                        </p>
                    </div>
                `
										: ''
								}
            </div>
        `
	})

	html += '</div>'
	container.innerHTML = html
	
	// Убираем класс loading-dots когда загрузка завершена
	const loadingElement = container.querySelector('.loading-dots')
	if (loadingElement) loadingElement.classList.remove('loading-dots')
}

// Проверить, можно ли отменить бронирование (должно быть больше 1 часа до начала)
function checkIfCanCancelBooking(bookingDate, bookingStartTime) {
	const now = new Date()
	
	// Создаем дату и время начала бронирования
	// Форматируем время (убираем секунды если есть)
	const timeStr = bookingStartTime.split(':').slice(0, 2).join(':')
	const bookingDateTime = new Date(`${bookingDate}T${timeStr}:00`)
	
	// Вычисляем разницу во времени в часах
	const timeDiff = (bookingDateTime - now) / (1000 * 60 * 60) // в часах
	
	// Можно отменить только если до начала больше 1 часа
	return timeDiff > 1
}

// Отменить бронирование
async function cancelBooking(bookingId) {
	if (!confirm(t('cancelBookingConfirm'))) {
		return
	}
	
	try {
		const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: currentUser.telegram_id,
			}),
		})
		
		console.log('📥 Статус ответа:', response.status, response.statusText)
		
		const data = await response.json()
		console.log('📥 Ответ от сервера при отмене:', data)
		
		if (response.ok && data.success) {
			// Находим карточку бронирования для анимации
			const bookingCard = document.querySelector(`.booking-card[data-booking-id="${bookingId}"]`)
			
			// Обновляем баланс коинов
			if (data.new_balance !== undefined) {
				userCoins = data.new_balance
				window.userCoins = data.new_balance
				updateCoinsDisplay()
			}
			
			// Показываем уведомление
			const notification = document.createElement('div')
			notification.style.cssText = `
				position: fixed;
				top: 20px;
				left: 50%;
				transform: translateX(-50%);
				background: rgba(16, 185, 129, 0.95);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				color: white;
				padding: 16px 24px;
				border-radius: 16px;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
				z-index: 10000;
				font-weight: 600;
				font-size: 14px;
				animation: slideDown 0.3s ease;
			`
			notification.textContent = `✅ ${t('bookingCancelled')} ${t('refunded')} ${data.refunded_coins} 🪙`
			document.body.appendChild(notification)
			
			// Удаляем уведомление через 3 секунды
			setTimeout(() => {
				notification.style.animation = 'slideUp 0.3s ease'
				setTimeout(() => notification.remove(), 300)
			}, 3000)
			
			// Добавляем анимацию исчезновения к карточке
			if (bookingCard) {
				bookingCard.classList.add('removing')
				
				// После завершения анимации обновляем список
				setTimeout(() => {
					loadBookings()
				}, 400) // Время анимации
			} else {
				// Если карточка не найдена, просто обновляем список
				loadBookings()
			}
		} else {
			const errorMessage = data.error || (window.t ? window.t('errorPrefix') + (window.t('cancelBooking') || 'Не удалось отменить бронирование') : 'Не удалось отменить бронирование')
			console.error('❌ Ошибка отмены бронирования:', errorMessage, data)
			alert(`❌ ${window.t ? window.t('errorPrefix') : 'Ошибка: '}${errorMessage}`)
		}
	} catch (error) {
		console.error('❌ Ошибка отмены бронирования:', error)
		alert(`❌ ${window.t ? window.t('connectionError') : 'Ошибка соединения с сервером'}`)
	}
}

// Навигация
function navigateTo(screen) {
	// Проверяем, что пользователь зарегистрирован перед навигацией
	if (!currentUser || !currentUser.school_login || !currentUser.phone) {
		// Если пользователь не зарегистрирован, показываем экран регистрации
		showScreen('registration')
		return
	}
	console.log(`📍 Навигация на: ${screen}`)

	if (screen === 'bookings') {
		loadMyBookings()
	} else if (screen === 'floors') {
		showFloorsScreen()
	} else {
		showScreen(screen)
	}
}

function checkIfSlotIsNow(slots) {
	const now = new Date()
	const currentTime = now.toTimeString().slice(0, 8) // HH:MM:SS

	return slots.some(slot => {
		return currentTime >= slot.start_time && currentTime < slot.end_time
	})
}

// Функция openBookingModal определена в booking.js
// Не переопределяем её здесь, используем напрямую из window.openBookingModal

// Вспомогательная функция для открытия модального окна бронирования
function openBookingModalWithRetry(room) {
	if (typeof window.openBookingModal === 'function') {
		window.openBookingModal(room)
		return
	}
	
	// Если booking.js еще не загрузился, ждем и пробуем снова
	console.warn('⚠️ window.openBookingModal не найдена, ждем загрузки booking.js...')
	window.selectedRoom = room
	window.bookingStep = 'select-date'
	
	// Пробуем несколько раз с увеличивающейся задержкой
	let attempts = 0
	const maxAttempts = 10
	const checkFunction = () => {
		attempts++
		if (typeof window.openBookingModal === 'function') {
			console.log(`✅ window.openBookingModal найдена после ${attempts} попыток`)
			window.openBookingModal(room)
		} else if (typeof window.showBookingModal === 'function') {
			console.log(`✅ window.showBookingModal найдена после ${attempts} попыток`)
			window.showBookingModal()
		} else if (attempts < maxAttempts) {
			setTimeout(checkFunction, 100 * attempts)
		} else {
			console.error('❌ window.showBookingModal не определена после всех попыток')
			console.error('Проверьте, что booking.js загружен правильно')
			alert(window.t ? window.t('bookingModuleError') : 'Ошибка: модуль бронирования не загружен. Пожалуйста, обновите страницу.')
		}
	}
	setTimeout(checkFunction, 100)
}

// Функция для открытия модального окна по ID комнаты
function openBookingModalById(roomId) {
	// Преобразуем ID в число для сравнения
	const id = parseInt(roomId)
	if (isNaN(id)) {
		console.error('❌ Неверный ID комнаты:', roomId)
		alert(window.t ? window.t('invalidRoomId') : 'Ошибка: неверный ID комнаты')
		return
	}
	
	console.log(`🔍 Ищем комнату с ID: ${id} (тип: ${typeof id})`)
	console.log(`📋 Доступно комнат в allRooms: ${allRooms.length}`)
	
	// Сначала пробуем найти в allRooms (сравниваем как числа)
	let room = allRooms.find(r => parseInt(r.id) === id)
	
	// Если не найдено, пробуем загрузить комнаты текущего этажа
	if (!room && currentFloor) {
		console.log(`🔄 Комната не найдена в allRooms, загружаем комнаты этажа ${currentFloor}...`)
		fetch(`/api/rooms/floor/${currentFloor}`)
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`)
				}
				return response.json()
			})
			.then(data => {
				if (data.success) {
					// Обновляем allRooms
					allRooms = data.rooms
					room = data.rooms.find(r => parseInt(r.id) === id)
					if (room) {
						console.log(`✅ Найдена комната: ${room.name}`)
						openBookingModalWithRetry(room)
					} else {
						console.error(`❌ Комната с ID ${id} не найдена на этаже ${currentFloor}`)
						alert(window.t ? window.t('roomNotFound') : 'Ошибка: комната не найдена')
					}
				} else {
					console.error('❌ Ошибка загрузки комнат:', data.error)
					alert((window.t ? window.t('errorLoadingData') : 'Ошибка загрузки данных: ') + (data.error || (window.t ? window.t('unknownError') : 'неизвестная ошибка')))
				}
			})
			.catch(error => {
				console.error('❌ Ошибка загрузки комнат:', error)
				alert(window.t ? window.t('errorLoadingRoom') : 'Ошибка загрузки данных комнаты. Проверьте подключение к интернету.')
			})
		return
	}
	
	if (room) {
		console.log(`✅ Найдена комната: ${room.name}`)
		openBookingModalWithRetry(room)
	} else {
		console.error(`❌ Комната с ID ${id} не найдена`)
		console.error(`📋 Доступные комнаты:`, allRooms)
		alert(window.t ? window.t('roomNotFoundRefresh') : 'Ошибка: комната не найдена. Попробуйте обновить страницу.')
	}
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp)

// Экспортируем функции для использования в HTML
window.registerUser = registerUser
window.navigateTo = navigateTo
window.selectFloor = selectFloor
window.showFloorsScreen = showFloorsScreen
// Не переопределяем window.openBookingModal, используем из booking.js
// Но экспортируем openBookingModalById для использования в onclick
window.openBookingModalById = openBookingModalById
window.getTelegramIdFromUrl = getTelegramIdFromUrl
window.loadRoomsByFloor = loadRoomsByFloor
window.updateCoinsDisplay = updateCoinsDisplay
window.checkIfSlotIsNow = checkIfSlotIsNow
window.cancelBooking = cancelBooking
window.cancelBooking = cancelBooking