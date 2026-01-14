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
		
		// Расширяем на весь экран
		Telegram.WebApp.expand()
		
		// Отключаем закрытие свайпом вниз
		if (Telegram.WebApp.disableVerticalSwipes) {
			Telegram.WebApp.disableVerticalSwipes()
		}
		
		// Включаем подтверждение закрытия (опционально)
		if (Telegram.WebApp.enableClosingConfirmation) {
			Telegram.WebApp.enableClosingConfirmation()
		}
		
		// Настраиваем цвет темы
		if (Telegram.WebApp.setHeaderColor) {
			Telegram.WebApp.setHeaderColor('#667eea')
		}
		
		// Настраиваем цвет фона
		if (Telegram.WebApp.setBackgroundColor) {
			Telegram.WebApp.setBackgroundColor('#f3f4f6')
		}
		
		console.log('✅ Telegram WebApp настроен на полноэкранный режим')
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

	// Настраиваем маску для телефона (регистрация)
	setupPhoneMask()
	
	// Настраиваем маску для поля входа
	setTimeout(() => {
		const loginPhoneInput = document.getElementById('login-phone')
		if (loginPhoneInput) {
			if (!loginPhoneInput.value || !loginPhoneInput.value.startsWith('+998-')) {
				loginPhoneInput.value = '+998-'
			}
			setupPhoneMaskForInput(loginPhoneInput)
		}
	}, 100)

	// Получаем telegram_id (работает и в Telegram и в браузере)
	const telegramId = getTelegramIdFromUrl()

	if (!telegramId) {
		console.warn('⚠️ Не удалось получить telegram_id')
		showScreen('registration')
		setupPhoneMask()
		// Настраиваем маску для поля входа
		setTimeout(() => {
			const loginPhoneInput = document.getElementById('login-phone')
			if (loginPhoneInput) {
				if (!loginPhoneInput.value || !loginPhoneInput.value.startsWith('+998-')) {
					loginPhoneInput.value = '+998-'
				}
				setupPhoneMaskForInput(loginPhoneInput)
			}
		}, 100)
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
			window.currentUser = data.user  // КРИТИЧНО: для использования в booking.js

			updateUserInfo(tgUser)
			updateCoinsDisplay()

			console.log('✅ Текущий пользователь установлен:', currentUser)

			// Если пользователь новый или не заполнил обязательные поля, показываем экран регистрации
			// (пользователь может зарегистрировать нового или войти в существующий профиль)
			if (data.user.is_new || !data.user.school_login || !data.user.phone) {
				console.log('📝 Показываем экран регистрации (пользователь может зарегистрироваться или войти)')
				showScreen('registration')
				setupPhoneMask()
			} else {
				// Сохраняем профиль в sessionStorage
				sessionStorage.setItem('currentProfile', JSON.stringify({
					school_login: data.user.school_login,
					phone: data.user.phone
				}))
				
				// Проверяем, является ли пользователь админом
				if (data.user.school_login && data.user.school_login.toLowerCase() === 'admin' && 
				    data.user.phone === '+998-00-000-00-11') {
					console.log('🔐 Пользователь является админом, показываем админ-страницу')
					showAdminScreen()
				} else {
					console.log('🏢 Показываем экран выбора этажа')
					loadAllRooms()
				}
			}
		} else {
			// Если ошибка авторизации, показываем экран регистрации
			console.log('⚠️ Ошибка авторизации, показываем экран регистрации')
			showScreen('registration')
			setupPhoneMask()
		}
	} catch (error) {
		console.error('❌ Auth error:', error)
		// При ошибке соединения показываем экран регистрации
		showScreen('registration')
		setupPhoneMask()
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

// Загрузка коинов с сервера
async function loadCoinsFromServer() {
	if (!currentUser) {
		console.error('❌ Нет текущего пользователя для загрузки коинов')
		return
	}

	try {
		// Формируем тело запроса - используем логин+телефон если доступны, иначе telegram_id
		const requestBody = {}
		if (currentUser.school_login && currentUser.phone) {
			requestBody.school_login = currentUser.school_login
			requestBody.phone = currentUser.phone
		} else if (currentUser.telegram_id) {
			requestBody.telegram_id = currentUser.telegram_id
		} else {
			console.error('❌ Не удалось определить пользователя для загрузки коинов')
			return
		}

		const response = await fetch('/api/coins', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		})

		const data = await response.json()

		if (data.success) {
			userCoins = data.coins || 0
			window.userCoins = userCoins
			updateCoinsDisplay()
			console.log(`✅ Коины загружены с сервера: ${userCoins} 🪙`)
		} else {
			console.error('Ошибка загрузки коинов:', data.error)
		}
	} catch (error) {
		console.error('❌ Error loading coins:', error)
	}
}

// Показать определенный экран
// Показать экран входа
function showLoginScreen() {
	console.log('🔐 Показываем экран входа')
	
	// Очищаем поля
	const loginSchoolLoginInput = document.getElementById('login-school-login')
	const loginPhoneInput = document.getElementById('login-phone')
	
	if (loginSchoolLoginInput) loginSchoolLoginInput.value = ''
	if (loginPhoneInput) {
		loginPhoneInput.value = '+998-'
		// Настраиваем маску для телефона на экране входа
		setupPhoneMaskForInput(loginPhoneInput)
	}
	
	// Убеждаемся, что экран входа существует
	const loginScreen = document.getElementById('login-screen')
	if (!loginScreen) {
		console.error('❌ Экран входа не найден в DOM')
		return
	}
	
	showScreen('login')
	
	// Дополнительная проверка, что экран показан
	setTimeout(() => {
		const displayed = window.getComputedStyle(loginScreen).display
		console.log('🔍 Экран входа display:', displayed)
		if (displayed === 'none') {
			console.error('❌ Экран входа не отображается!')
			loginScreen.style.display = 'block'
		}
	}, 100)
}

// Настройка маски для конкретного input
function formatUzbekPhone(inputValue) {
	// Удаляем все нецифровые символы
	let digits = inputValue.replace(/\D/g, '')
	
	// Если номер начинается с 998, убираем его (будем добавлять +998-)
	if (digits.startsWith('998')) {
		digits = digits.substring(3)
	}
	
	// Ограничиваем до 9 цифр (после кода страны)
	if (digits.length > 9) {
		digits = digits.substring(0, 9)
	}
	
	// Форматируем: +998-XX-XXX-XX-XX
	let formatted = '+998-'
	if (digits.length > 0) {
		formatted += digits.substring(0, 2) // Первые 2 цифры
	}
	if (digits.length > 2) {
		formatted += '-' + digits.substring(2, 5) // Следующие 3 цифры
	}
	if (digits.length > 5) {
		formatted += '-' + digits.substring(5, 7) // Следующие 2 цифры
	}
	if (digits.length > 7) {
		formatted += '-' + digits.substring(7, 9) // Последние 2 цифры
	}
	
	return formatted
}

function setupPhoneMaskForInput(input) {
	if (!input) return
	
	// Устанавливаем начальное значение, если поле пустое
	if (!input.value || input.value.trim() === '' || !input.value.startsWith('+998-')) {
		input.value = '+998-'
	}
	
	// Устанавливаем начальное значение, если поле пустое
	if (!input.value || input.value.trim() === '' || !input.value.startsWith('+998-')) {
		input.value = '+998-'
	}
	
	// Проверяем, не добавлены ли уже обработчики (чтобы избежать дублирования)
	// Если маска уже применена, просто убеждаемся, что значение корректное
	if (input.dataset.phoneMaskSetup === 'true') {
		// Маска уже применена - просто убеждаемся, что значение корректное
		if (!input.value.startsWith('+998-')) {
			input.value = '+998-'
		}
		// Не добавляем обработчики повторно, чтобы избежать дублирования
		return
	}
	input.dataset.phoneMaskSetup = 'true'
	
	// Обработчик ввода
	input.addEventListener('input', function(e) {
		let inputValue = e.target.value
		
		// Если номер уже в правильном формате, не форматируем повторно
		const correctPattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
		if (correctPattern.test(inputValue)) {
			return // Уже правильно отформатирован
		}
		
		// Защита префикса +998-: если пользователь пытается удалить его, восстанавливаем
		if (!inputValue.startsWith('+998-')) {
			// Если префикс был удален, восстанавливаем его
			inputValue = '+998-' + inputValue.replace(/^\+?998-?/, '').replace(/\D/g, '')
		}
		
		// Форматируем номер
		let formatted = formatUzbekPhone(inputValue)
		
		// Обновляем только если значение изменилось
		if (e.target.value !== formatted) {
			// Сохраняем позицию курсора
			const cursorPos = e.target.selectionStart
			e.target.value = formatted
			
			// Восстанавливаем позицию курсора (с учетом добавленных дефисов)
			let newCursorPos = cursorPos
			if (formatted.length > inputValue.length) {
				// Если добавились дефисы, корректируем позицию
				const addedChars = formatted.length - inputValue.length
				newCursorPos = Math.min(cursorPos + addedChars, formatted.length)
			}
			e.target.setSelectionRange(newCursorPos, newCursorPos)
		}
	})
	
	// Обработчик удаления (Backspace/Delete) - защищаем префикс
	input.addEventListener('keydown', function(e) {
		const inputValue = e.target.value
		const cursorPos = e.target.selectionStart
		
		// Если пользователь пытается удалить символы в префиксе +998-
		if (cursorPos <= 5) { // 5 символов = "+998-"
			// Разрешаем удаление только если курсор находится после префикса
			if (e.key === 'Backspace' && cursorPos < 5) {
				e.preventDefault()
				// Перемещаем курсор после префикса
				e.target.setSelectionRange(5, 5)
			} else if (e.key === 'Delete' && cursorPos < 5) {
				e.preventDefault()
			}
		}
	})
	
	// Обработчик вставки (Ctrl+V) - форматируем вставленный текст
	input.addEventListener('paste', function(e) {
		e.preventDefault()
		const pastedText = (e.clipboardData || window.clipboardData).getData('text')
		
		// Форматируем вставленный текст
		let formatted = formatUzbekPhone(pastedText)
		
		// Вставляем отформатированный текст
		const cursorPos = e.target.selectionStart
		const currentValue = e.target.value
		
		// Заменяем текст на позиции курсора
		const beforeCursor = currentValue.substring(0, Math.max(5, cursorPos)) // Минимум +998-
		const afterCursor = currentValue.substring(cursorPos)
		
		// Убираем префикс из вставленного текста, если он есть
		let textToInsert = formatted.replace(/^\+998-/, '')
		
		// Объединяем и форматируем заново
		let newValue = beforeCursor + textToInsert + afterCursor
		newValue = formatUzbekPhone(newValue)
		
		e.target.value = newValue
		
		// Устанавливаем курсор в конец вставленного текста
		const newCursorPos = Math.min(beforeCursor.length + textToInsert.length, newValue.length)
		e.target.setSelectionRange(newCursorPos, newCursorPos)
	})
	
	// Обработчик фокуса
	input.addEventListener('focus', function(e) {
		if (!e.target.value || e.target.value.trim() === '' || !e.target.value.startsWith('+998-')) {
			e.target.value = '+998-'
		}
		// Если курсор находится в начале, перемещаем его после префикса
		if (e.target.selectionStart < 5) {
			e.target.setSelectionRange(5, 5)
		}
	})
	
	// Обработчик потери фокуса - проверяем и исправляем формат
	input.addEventListener('blur', function(e) {
		let value = e.target.value
		
		// Всегда должны иметь префикс +998-
		if (!value.startsWith('+998-')) {
			value = '+998-'
		}
		
		if (value && value.trim() !== '' && value !== '+998-') {
			// Если значение не пустое и не только +998-, проверяем формат
			const correctPattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
			if (!correctPattern.test(value)) {
				// Если формат неправильный, пытаемся исправить
				value = formatUzbekPhone(value)
			}
		} else {
			value = '+998-'
		}
		
		e.target.value = value
	})
}

// Переключение между вкладками входа и регистрации
function switchToLogin() {
	const loginTab = document.getElementById('login-tab')
	const registerTab = document.getElementById('register-tab')
	const loginForm = document.getElementById('login-form')
	const registerForm = document.getElementById('register-form')
	
	// Устанавливаем начальное значение "+998-" в поле телефона входа и применяем маску
	const loginPhoneInput = document.getElementById('login-phone')
	if (loginPhoneInput) {
		// Всегда применяем маску при переключении на вкладку входа
		if (!loginPhoneInput.value || !loginPhoneInput.value.startsWith('+998-')) {
			loginPhoneInput.value = '+998-'
		}
		// Сбрасываем флаг, чтобы маска могла быть применена заново
		loginPhoneInput.dataset.phoneMaskSetup = 'false'
		// Применяем маску
		setupPhoneMaskForInput(loginPhoneInput)
	}
	
	if (loginTab && registerTab && loginForm && registerForm) {
		// Если форма регистрации видна, сначала скрываем её с анимацией
		if (registerForm.style.display === 'block' || registerForm.classList.contains('showing')) {
			registerForm.classList.remove('showing')
			registerForm.classList.add('hiding')
			
			// После завершения анимации скрытия, показываем форму входа
			setTimeout(() => {
				registerForm.style.display = 'none'
				registerForm.classList.remove('hiding')
				
				loginForm.style.display = 'block'
				loginForm.classList.add('showing')
				
				// Убираем класс showing после завершения анимации
				setTimeout(() => {
					loginForm.classList.remove('showing')
				}, 400)
			}, 200)
		} else {
			// Если форма регистрации уже скрыта, просто показываем форму входа
			loginForm.style.display = 'block'
			loginForm.classList.add('showing')
			setTimeout(() => {
				loginForm.classList.remove('showing')
			}, 400)
		}
		
		// Активируем вкладку входа с плавной анимацией
		loginTab.classList.add('active')
		loginTab.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
		loginTab.style.color = 'white'
		
		// Деактивируем вкладку регистрации с плавной анимацией
		registerTab.classList.remove('active')
		registerTab.style.background = 'transparent'
		registerTab.style.color = '#94a3b8'
		
		// Убеждаемся, что маска применена после показа формы
		setTimeout(() => {
			const loginPhoneInputAfter = document.getElementById('login-phone')
			if (loginPhoneInputAfter) {
				setupPhoneMaskForInput(loginPhoneInputAfter)
			}
		}, 450)
	}
}

function switchToRegister() {
	const loginTab = document.getElementById('login-tab')
	const registerTab = document.getElementById('register-tab')
	const loginForm = document.getElementById('login-form')
	const registerForm = document.getElementById('register-form')
	
	if (loginTab && registerTab && loginForm && registerForm) {
		// Если форма входа видна, сначала скрываем её с анимацией
		if (loginForm.style.display === 'block' || loginForm.classList.contains('showing')) {
			loginForm.classList.remove('showing')
			loginForm.classList.add('hiding')
			
			// После завершения анимации скрытия, показываем форму регистрации
			setTimeout(() => {
				loginForm.style.display = 'none'
				loginForm.classList.remove('hiding')
				
				registerForm.style.display = 'block'
				registerForm.classList.add('showing')
				
				// Убираем класс showing после завершения анимации
				setTimeout(() => {
					registerForm.classList.remove('showing')
				}, 400)
			}, 200)
		} else {
			// Если форма входа уже скрыта, просто показываем форму регистрации
			registerForm.style.display = 'block'
			registerForm.classList.add('showing')
			setTimeout(() => {
				registerForm.classList.remove('showing')
			}, 400)
		}
		
		// Деактивируем вкладку входа с плавной анимацией
		loginTab.classList.remove('active')
		loginTab.style.background = 'transparent'
		loginTab.style.color = '#94a3b8'
		
		// Активируем вкладку регистрации с плавной анимацией
		registerTab.classList.add('active')
		registerTab.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
		registerTab.style.color = 'white'
		
		// При переключении на регистрацию всегда разрешаем редактирование логина
		const schoolLoginInput = document.getElementById('school-login')
		const schoolLoginLabel = document.querySelector('label[for="school-login"]')
		
		if (schoolLoginInput) {
			// Всегда разрешаем редактирование логина
			schoolLoginInput.disabled = false
			schoolLoginInput.style.opacity = '1'
			schoolLoginInput.style.cursor = 'text'
			
			// Если у пользователя уже есть логин, показываем его, но разрешаем изменить
			if (currentUser && currentUser.school_login && currentUser.school_login.trim()) {
				schoolLoginInput.value = currentUser.school_login
			} else {
				schoolLoginInput.value = ''
			}
			
			if (schoolLoginLabel) {
				schoolLoginLabel.textContent = window.t ? window.t('schoolLogin') : 'Школьный логин'
			}
		}
	}
}

// Вход по логину и телефону (с экрана регистрации)
async function loginUser() {
	// Пробуем получить данные из формы входа на экране регистрации
	let schoolLogin = document.getElementById('login-school-login')?.value.trim()
	let phone = document.getElementById('login-phone')?.value.trim()
	
	// Если не найдены, пробуем из отдельного экрана входа
	if (!schoolLogin || !phone) {
		const loginScreenLogin = document.getElementById('login-screen-school-login')?.value.trim()
		const loginScreenPhone = document.getElementById('login-screen-phone')?.value.trim()
		if (loginScreenLogin && loginScreenPhone) {
			schoolLogin = loginScreenLogin
			phone = loginScreenPhone
		}
	}
	
	// Валидация обязательных полей
	if (!schoolLogin) {
		alert('Введите школьный логин!')
		return
	}
	
	if (!phone) {
		alert('Введите номер телефона!')
		return
	}
	
	// Валидация формата телефона
	const phonePattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
	if (!phonePattern.test(phone)) {
		alert('Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX')
		return
	}
	
	try {
		const response = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				school_login: schoolLogin,
				phone: phone,
			}),
		})
		
		const data = await response.json()
		
		if (data.success) {
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}
			
			// Обновляем текущего пользователя
			currentUser = data.user
			userCoins = data.user.coins || 0
			window.userCoins = userCoins
			window.currentUser = data.user  // КРИТИЧНО: для использования в booking.js
			
			// Сохраняем текущий профиль в sessionStorage
			sessionStorage.setItem('currentProfile', JSON.stringify({
				school_login: schoolLogin,
				phone: phone
			}))
			
			// Обновляем отображение
			const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
				first_name: window.t ? window.t('user') : 'Пользователь',
				username: '',
			}
			updateUserInfo(tgUser)
			updateCoinsDisplay()
			
			// Проверяем, является ли пользователь админом
			if (schoolLogin.toLowerCase() === 'admin' && phone === '+998-00-000-00-11') {
				console.log('🔐 Пользователь является админом, показываем админ-страницу')
				showAdminScreen()
			} else {
				console.log('🏢 Показываем экран выбора этажа')
				showFloorsScreen()
				loadAllRooms()
			}
		} else {
			alert('Ошибка: ' + data.error)
		}
	} catch (error) {
		alert('Ошибка сети: ' + error.message)
		console.error(error)
	}
}

// Вход по логину и телефону (с отдельного экрана входа - старая функция для обратной совместимости)
async function loginUserFromSeparateScreen() {
	const schoolLogin = document.getElementById('login-screen-school-login')?.value.trim()
	const phone = document.getElementById('login-screen-phone')?.value.trim()
	
	if (!schoolLogin || !phone) {
		alert('Введите логин и телефон!')
		return
	}
	
	// Используем ту же логику, что и в loginUser
	await performLogin(schoolLogin, phone)
}

// Показать красивое уведомление с предложением зарегистрироваться
function showRegistrationPrompt() {
	// Удаляем предыдущее уведомление, если есть
	const existingPrompt = document.getElementById('registration-prompt')
	if (existingPrompt) {
		existingPrompt.remove()
	}
	
	// Создаем уведомление
	const prompt = document.createElement('div')
	prompt.id = 'registration-prompt'
	prompt.innerHTML = `
		<div class="prompt-content">
			<div class="prompt-icon">
				<i class="fas fa-user-plus"></i>
			</div>
			<h3>👋 Пользователь не найден!</h3>
			<p>Сначала нужно зарегистрироваться, чтобы войти в систему</p>
			<button class="btn btn-primary prompt-button" onclick="switchToRegisterAndClosePrompt()">
				<i class="fas fa-user-plus"></i>&nbsp; Зарегистрироваться
			</button>
			<button class="btn btn-secondary prompt-close" onclick="closeRegistrationPrompt()" style="margin-top: 8px;">
				Закрыть
			</button>
		</div>
	`
	
	document.body.appendChild(prompt)
	
	// Анимация появления
	setTimeout(() => {
		prompt.classList.add('show')
	}, 10)
	
	// Автоматически закрываем через 8 секунд
	setTimeout(() => {
		closeRegistrationPrompt()
	}, 8000)
}

// Переключиться на регистрацию и закрыть уведомление
function switchToRegisterAndClosePrompt() {
	closeRegistrationPrompt()
	switchToRegister()
}

// Закрыть уведомление
function closeRegistrationPrompt() {
	const prompt = document.getElementById('registration-prompt')
	if (prompt) {
		prompt.classList.remove('show')
		setTimeout(() => {
			prompt.remove()
		}, 300)
	}
}

// Общая функция для выполнения входа
async function performLogin(schoolLogin, phone) {
	// Валидация формата телефона
	const phonePattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
	if (!phonePattern.test(phone)) {
		alert('Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX')
		return
	}
	
	try {
		const response = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				school_login: schoolLogin,
				phone: phone,
			}),
		})
		
		const data = await response.json()
		
		if (data.success) {
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}
			
			// Обновляем текущего пользователя
			currentUser = data.user
			userCoins = data.user.coins || 0
			window.userCoins = userCoins
			window.currentUser = data.user  // КРИТИЧНО: для использования в booking.js
			
			// Сохраняем текущий профиль в sessionStorage
			sessionStorage.setItem('currentProfile', JSON.stringify({
				school_login: schoolLogin,
				phone: phone
			}))
			
			// Обновляем отображение
			const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
				first_name: window.t ? window.t('user') : 'Пользователь',
				username: '',
			}
			updateUserInfo(tgUser)
			updateCoinsDisplay()
			
			// Проверяем, является ли пользователь админом
			if (schoolLogin.toLowerCase() === 'admin' && phone === '+998-00-000-00-11') {
				console.log('🔐 Пользователь является админом, показываем админ-страницу')
				showAdminScreen()
			} else {
				console.log('🏢 Показываем экран выбора этажа')
				showFloorsScreen()
				loadAllRooms()
			}
		} else {
			// Проверяем, является ли это ошибкой "пользователь не найден"
			// Но для админа не показываем предложение зарегистрироваться
			const isAdminAttempt = schoolLogin.toLowerCase() === 'admin' && phone === '+998-00-000-00-11'
			
			if (data.error && (data.error.includes('не найден') || data.error.includes('not found'))) {
				if (isAdminAttempt) {
					// Для админа показываем специальное сообщение
					alert('Админ не найден в базе данных. Пожалуйста, сначала зарегистрируйте админа через регистрацию.')
				} else {
					showRegistrationPrompt()
				}
			} else {
				alert('Ошибка: ' + data.error)
			}
		}
	} catch (error) {
		alert('Ошибка сети: ' + error.message)
		console.error(error)
	}
}

// Функция для открытия экрана регистрации (для редактирования профиля или входа)
function showRegistrationScreen() {
	console.log('📝 Открываем экран регистрации/входа')
	
	// Сбрасываем вкладки на "Вход" по умолчанию
	switchToLogin()
	
	// Очищаем поля входа
	const loginSchoolLoginInput = document.getElementById('login-school-login')
	const loginPhoneInput = document.getElementById('login-phone')
	if (loginSchoolLoginInput) loginSchoolLoginInput.value = ''
	if (loginPhoneInput) {
		loginPhoneInput.value = '+998-'
		setupPhoneMaskForInput(loginPhoneInput)
	}
	
	// Очищаем поля регистрации и всегда разрешаем редактирование логина
	const schoolLoginInput = document.getElementById('school-login')
	const phoneInput = document.getElementById('phone')
	const schoolLoginLabel = document.querySelector('label[for="school-login"]')
	
	// Всегда разрешаем редактирование логина
	if (schoolLoginInput) {
		schoolLoginInput.disabled = false
		schoolLoginInput.style.opacity = '1'
		schoolLoginInput.style.cursor = 'text'
		
		// Если у пользователя уже есть логин, показываем его, но разрешаем изменить
		if (currentUser && currentUser.school_login && currentUser.school_login.trim()) {
			schoolLoginInput.value = currentUser.school_login
		} else {
			schoolLoginInput.value = ''
		}
		
		if (schoolLoginLabel) {
			schoolLoginLabel.textContent = window.t ? window.t('schoolLogin') : 'Школьный логин'
		}
	}
	
	if (phoneInput) {
		if (currentUser && currentUser.phone) {
			phoneInput.value = currentUser.phone
		} else {
			phoneInput.value = ''
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
	const screens = ['floors', 'main', 'registration', 'bookings', 'error', 'admin', 'login']
	screens.forEach(screen => {
		const element = document.getElementById(`${screen}-screen`)
		if (element) element.style.display = 'none'
	})

	// Показать нужный экран
	const targetScreen = document.getElementById(`${screenId}-screen`)
	if (targetScreen) {
		// Принудительно показываем экран
		targetScreen.style.display = 'block'
		targetScreen.style.visibility = 'visible'
		targetScreen.style.opacity = '1'
		
		console.log(`✅ Экран ${screenId} установлен на display: block`)
		
		// Скрыть/показать навигационную панель в зависимости от экрана
		const navBar = document.querySelector('.nav-bar')
		if (navBar) {
			// Скрываем навигацию на экране регистрации, ошибки, админки и входа
			if (screenId === 'registration' || screenId === 'error' || screenId === 'admin' || screenId === 'login') {
				navBar.style.display = 'none'
				console.log(`🔒 Навигационная панель скрыта для экрана ${screenId}`)
			} else {
				navBar.style.display = 'flex'
				console.log(`🔓 Навигационная панель показана для экрана ${screenId}`)
			}
		} else {
			console.warn('⚠️ Навигационная панель не найдена')
		}
		
		// Если показываем экран регистрации, настраиваем маску телефона
		if (screenId === 'registration') {
			setTimeout(() => setupPhoneMask(), 100) // Небольшая задержка для гарантии, что элемент существует
		}
	} else {
		console.error(`❌ Экран ${screenId}-screen не найден в DOM!`)
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
		showRegistrationScreen()
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

// Показать skeleton screens для загрузки комнат
function showRoomsSkeleton() {
	const container = document.getElementById('rooms-container')
	if (!container) return
	
	let skeletonHTML = ''
	for (let i = 0; i < 6; i++) {
		skeletonHTML += '<div class="skeleton skeleton-room-card"></div>'
	}
	container.innerHTML = skeletonHTML
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
	
	// Применяем stagger анимацию к карточкам комнат
	setTimeout(() => {
		const roomCards = container.querySelectorAll('.room-card')
		roomCards.forEach((card, index) => {
			card.style.animationDelay = `${index * 0.05}s`
		})
	}, 10)
	
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
// Функция checkIfRoomIsBusyNow удалена - не используется

// Валидация логина на фронтенде
function validateLoginFormat(login) {
	if (!login) {
		return { valid: false, error: 'Логин не может быть пустым' }
	}
	
	login = login.trim().toLowerCase()
	
	// 1. Проверка длины
	if (login.length !== 8) {
		return { valid: false, error: `Логин должен быть ровно 8 символов. Текущая длина: ${login.length}` }
	}
	
	// 2. Проверка на только строчные английские буквы
	if (!/^[a-z]{8}$/.test(login)) {
		if (/[A-Z]/.test(login)) {
			return { valid: false, error: 'Логин не должен содержать заглавные буквы. Используйте только строчные буквы (a-z)' }
		}
		if (/[0-9]/.test(login)) {
			return { valid: false, error: 'Логин не должен содержать цифры. Используйте только строчные буквы (a-z)' }
		}
		if (/[^a-z]/.test(login)) {
			return { valid: false, error: 'Логин не должен содержать специальные символы. Используйте только строчные буквы (a-z)' }
		}
		return { valid: false, error: 'Логин должен содержать только строчные английские буквы (a-z)' }
	}
	
	// 3. Проверка гласных в первых 6 символах
	const firstSix = login.substring(0, 6)
	const vowels = ['a', 'e', 'i', 'o', 'u']
	const hasVowel = vowels.some(vowel => firstSix.includes(vowel))
	
	if (!hasVowel) {
		return { valid: false, error: 'Первые 6 символов логина должны содержать хотя бы одну гласную букву (a, e, i, o, u)' }
	}
	
	// Все проверки пройдены
	return { valid: true, error: '' }
}

// Обработка регистрации (только регистрация, без попытки входа)
async function registerUser() {
	const schoolLogin = document.getElementById('school-login').value.trim()
	const phone = document.getElementById('phone').value.trim()

	// Валидация обязательных полей
	if (!schoolLogin) {
		alert('Введите школьный логин!')
		return
	}

	if (!phone) {
		alert('Введите номер телефона!')
		return
	}

	// Валидация формата логина
	const loginValidation = validateLoginFormat(schoolLogin)
	if (!loginValidation.valid) {
		alert('Ошибка валидации логина: ' + loginValidation.error)
		return
	}

	// Валидация формата телефона (узбекский формат: +998-XX-XXX-XX-XX)
	const phonePattern = /^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$/
	if (!phonePattern.test(phone)) {
		alert('Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)')
		return
	}

	if (!currentUser || !currentUser.telegram_id) {
		alert('Ошибка: не удалось определить пользователя для регистрации')
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
			console.log('✅ Новый пользователь зарегистрирован')
			
			if (Telegram.WebApp && Telegram.WebApp.HapticFeedback) {
				Telegram.WebApp.HapticFeedback.notificationOccurred('success')
			}

			// Обновляем информацию о пользователе
			currentUser.school_login = schoolLogin
			currentUser.phone = phone
			
			// КРИТИЧНО: Обновляем window.currentUser для использования в booking.js
			if (window.currentUser) {
				window.currentUser.school_login = schoolLogin
				window.currentUser.phone = phone
			} else {
				window.currentUser = currentUser
			}
			
			// Сохраняем профиль в sessionStorage
			sessionStorage.setItem('currentProfile', JSON.stringify({
				school_login: schoolLogin,
				phone: phone
			}))

			// Обновляем отображение
			const tgUser = Telegram.WebApp.initDataUnsafe?.user || {
				first_name: window.t ? window.t('user') : 'Пользователь',
				username: '',
			}
			updateUserInfo(tgUser)
			updateCoinsDisplay()

			// Проверяем, является ли пользователь админом
			if (schoolLogin.toLowerCase() === 'admin' && phone === '+998-00-000-00-11') {
				console.log('🔐 Пользователь является админом, показываем админ-страницу')
				showAdminScreen()
			} else {
				console.log('🏢 Показываем экран выбора этажа')
				showFloorsScreen()
				loadAllRooms()
			}
		} else {
			console.error('Ошибка регистрации:', data.error)
			alert('Ошибка регистрации: ' + data.error)
		}
	} catch (error) {
		alert('Ошибка сети: ' + error.message)
		console.error(error)
	}
}

// Загрузка моих бронирований (ИСПРАВЛЕНО: теперь POST запрос)
async function loadMyBookings() {
	if (!currentUser) {
		console.error('❌ Нет текущего пользователя')
		return
	}

	// Показываем skeleton screens при загрузке
	showBookingsSkeleton()

	// Формируем тело запроса - используем логин+телефон если доступны, иначе telegram_id
	const requestBody = {}
	if (currentUser.school_login && currentUser.phone) {
		requestBody.school_login = currentUser.school_login
		requestBody.phone = currentUser.phone
	} else if (currentUser.telegram_id) {
		requestBody.telegram_id = currentUser.telegram_id
	} else {
		console.error('❌ Не удалось определить пользователя', currentUser)
		return
	}

	console.log('📤 Отправляем запрос на /api/my-bookings:', requestBody)
	console.log('👤 Текущий пользователь:', currentUser)

	try {
		const response = await fetch('/api/my-bookings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		})
		
		console.log('📥 Ответ получен:', response.status, response.statusText)
		
		if (!response.ok) {
			const errorText = await response.text()
			console.error('❌ Ошибка ответа:', response.status, errorText)
			throw new Error(`HTTP ${response.status}: ${errorText}`)
		}
		
		const data = await response.json()
		console.log('📊 Данные получены:', data)

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

// Обновление списка бронирований без переключения экрана (для использования после создания бронирования)
async function refreshBookingsList() {
	if (!currentUser) {
		console.error('❌ Нет текущего пользователя')
		return
	}

	// Формируем тело запроса - используем логин+телефон если доступны, иначе telegram_id
	const requestBody = {}
	if (currentUser.school_login && currentUser.phone) {
		requestBody.school_login = currentUser.school_login
		requestBody.phone = currentUser.phone
	} else if (currentUser.telegram_id) {
		requestBody.telegram_id = currentUser.telegram_id
	} else {
		console.error('❌ Не удалось определить пользователя')
		return
	}

	try {
		const response = await fetch('/api/my-bookings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		})
		const data = await response.json()

		if (data.success) {
			// Обновляем список только если экран "Мои бронирования" виден
			const bookingsScreen = document.getElementById('bookings-screen')
			const isBookingsScreenVisible = bookingsScreen && 
				bookingsScreen.style.display !== 'none' && 
				bookingsScreen.style.visibility !== 'hidden' &&
				bookingsScreen.offsetParent !== null
			
			if (isBookingsScreenVisible) {
				displayBookings(data.bookings)
				console.log('✅ Список бронирований обновлен на экране "Мои бронирования"')
			} else {
				console.log('ℹ️ Экран "Мои бронирования" не виден, данные обновлены в фоне')
			}
		} else {
			console.error('Ошибка обновления бронирований:', data.error)
		}
	} catch (error) {
		console.error('❌ Error refreshing bookings:', error)
	}
}

// Показать skeleton screens для загрузки бронирований
function showBookingsSkeleton() {
	const container = document.getElementById('bookings-container')
	if (!container) return
	
	let skeletonHTML = '<div class="space-y-4">'
	for (let i = 0; i < 3; i++) {
		skeletonHTML += '<div class="skeleton skeleton-booking-card"></div>'
	}
	skeletonHTML += '</div>'
	container.innerHTML = skeletonHTML
}

// Отображение бронирований
// Функция для группировки и объединения последовательных бронирований
function groupAndMergeBookings(bookings) {
	if (!bookings || bookings.length === 0) {
		return []
	}

	// Сортируем бронирования по дате, комнате и времени начала
	const sortedBookings = [...bookings].sort((a, b) => {
		// Сначала по дате
		if (a.date !== b.date) {
			return a.date.localeCompare(b.date)
		}
		// Затем по комнате
		if (a.room_id !== b.room_id) {
			return a.room_id - b.room_id
		}
		// Затем по времени начала
		return a.start_time.localeCompare(b.start_time)
	})

	// Группируем по дате и комнате
	const grouped = {}
	sortedBookings.forEach(booking => {
		if (booking.status !== 'confirmed') {
			// Отмененные бронирования не группируем
			const key = `cancelled_${booking.id}`
			if (!grouped[key]) {
				grouped[key] = []
			}
			grouped[key].push(booking)
			return
		}

		const key = `${booking.date}_${booking.room_id}`
		if (!grouped[key]) {
			grouped[key] = []
		}
		grouped[key].push(booking)
	})

	// Объединяем последовательные временные слоты в каждой группе
	const mergedBookings = []
	
	Object.keys(grouped).forEach(key => {
		const group = grouped[key]
		
		// Если это отмененное бронирование, добавляем как есть
		if (key.startsWith('cancelled_')) {
			mergedBookings.push(...group)
			return
		}

		// Объединяем последовательные слоты
		let currentGroup = [group[0]]
		
		for (let i = 1; i < group.length; i++) {
			const prevBooking = currentGroup[currentGroup.length - 1]
			const currentBooking = group[i]
			
			// Проверяем, является ли текущее бронирование продолжением предыдущего
			const prevEnd = prevBooking.end_time.split(':').slice(0, 2).join(':')
			const currentStart = currentBooking.start_time.split(':').slice(0, 2).join(':')
			
			// Если время окончания предыдущего равно времени начала текущего
			if (prevEnd === currentStart && 
			    prevBooking.room_id === currentBooking.room_id &&
			    prevBooking.date === currentBooking.date) {
				// Объединяем: обновляем время окончания и ID
				currentGroup.push(currentBooking)
			} else {
				// Создаем объединенное бронирование из текущей группы
				if (currentGroup.length > 1) {
					const merged = createMergedBooking(currentGroup)
					mergedBookings.push(merged)
				} else {
					mergedBookings.push(currentGroup[0])
				}
				// Начинаем новую группу
				currentGroup = [currentBooking]
			}
		}
		
		// Обрабатываем последнюю группу
		if (currentGroup.length > 1) {
			const merged = createMergedBooking(currentGroup)
			mergedBookings.push(merged)
		} else if (currentGroup.length === 1) {
			mergedBookings.push(currentGroup[0])
		}
	})

	// Сортируем результат по дате и времени
	return mergedBookings.sort((a, b) => {
		if (a.date !== b.date) {
			return a.date.localeCompare(b.date)
		}
		return a.start_time.localeCompare(b.start_time)
	})
}

// Создать объединенное бронирование из группы
function createMergedBooking(bookings) {
	if (bookings.length === 0) return null
	if (bookings.length === 1) return bookings[0]

	// Берем первое бронирование как основу
	const first = bookings[0]
	const last = bookings[bookings.length - 1]

	// Вычисляем общую стоимость
	const totalPrice = bookings.reduce((sum, b) => sum + (b.price || 0), 0)

	// Вычисляем общую длительность в часах
	const startTime = first.start_time.split(':').slice(0, 2).join(':')
	const endTime = last.end_time.split(':').slice(0, 2).join(':')
	
	// Создаем объединенное бронирование
	const merged = {
		...first,
		id: bookings.map(b => b.id).join(','), // Все ID через запятую
		start_time: first.start_time,
		end_time: last.end_time,
		price: totalPrice,
		merged_count: bookings.length, // Количество объединенных слотов
		merged_ids: bookings.map(b => b.id), // Массив ID для отмены
		original_bookings: bookings // Оригинальные бронирования для отмены
	}

	return merged
}

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

	// Группируем и объединяем последовательные бронирования
	const mergedBookings = groupAndMergeBookings(bookings)

	let html = '<div class="space-y-4">'

	mergedBookings.forEach((booking, index) => {
		const date = new Date(booking.date)
		const locale = window.currentLanguage === 'uz' ? 'uz-UZ' : 'ru-RU'
		const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
		
		// Проверяем, переходит ли бронирование через полночь
		const startTime = booking.start_time.split(':').slice(0, 2).join(':') // Убираем секунды если есть
		const endTime = booking.end_time.split(':').slice(0, 2).join(':') // Убираем секунды если есть
		const crossesMidnight = booking.crosses_midnight || endTime < startTime
		const isContinuation = booking.is_continuation || false
		
		// Проверяем, является ли это объединенным бронированием
		const isMerged = booking.merged_count && booking.merged_count > 1
		const slotsCount = booking.merged_count || 1
		
		// Вычисляем длительность в часах
		let durationHours = 0
		if (crossesMidnight) {
			// Если переходит через полночь
			const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
			const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])
			durationHours = (24 * 60 - startMinutes + endMinutes) / 60
		} else {
			const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
			const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])
			durationHours = (endMinutes - startMinutes) / 60
		}
		
		let timeDisplay = ''
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
		
		// Добавляем информацию об объединенных слотах
		if (isMerged) {
			const hoursText = durationHours === 1 ? 'час' : durationHours < 5 ? 'часа' : 'часов'
			timeDisplay += ` <span style="background: rgba(59, 130, 246, 0.15); padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; color: #3B82F6; margin-left: 8px;">${slotsCount} слота • ${durationHours.toFixed(1)} ${hoursText}</span>`
		}

		// Проверяем, можно ли отменить бронирование (должно быть больше 1 часа до начала)
		const canCancel = checkIfCanCancelBooking(booking.date, booking.start_time)
		
		// Формируем ID для data-атрибута (для объединенных - все ID через запятую)
		const bookingIdAttr = isMerged && booking.merged_ids 
			? booking.merged_ids.join(',') 
			: booking.id.toString()
		
		html += `
            <div class="card booking-card" data-booking-id="${bookingIdAttr}">
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
                        ${isMerged 
                            ? `ID: #${booking.merged_ids.map(id => id.toString().padStart(4, '0')).join(', #')}`
                            : `ID: #${booking.id.toString().padStart(4, '0')}`
                        }
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
	// Проверяем, является ли это объединенным бронированием
	// Ищем карточку бронирования в DOM
	const bookingCard = document.querySelector(`.booking-card[data-booking-id*="${bookingId}"]`)
	let isMerged = false
	let mergedIds = []
	
	if (bookingCard) {
		// Проверяем, содержит ли ID запятую (объединенное бронирование)
		const cardBookingId = bookingCard.getAttribute('data-booking-id')
		if (cardBookingId && cardBookingId.includes(',')) {
			isMerged = true
			mergedIds = cardBookingId.split(',').map(id => parseInt(id.trim()))
		}
	}
	
	// Формируем сообщение подтверждения
	let confirmMessage = t('cancelBookingConfirm')
	if (isMerged && mergedIds.length > 1) {
		confirmMessage = `Вы уверены, что хотите отменить все ${mergedIds.length} бронирования?`
	}
	
	if (!confirm(confirmMessage)) {
		return
	}
	
	if (!currentUser) {
		alert('Ошибка: пользователь не авторизован')
		return
	}
	
	// Формируем тело запроса - используем логин+телефон если доступны, иначе telegram_id
	const requestBody = {}
	if (currentUser.school_login && currentUser.phone) {
		requestBody.school_login = currentUser.school_login
		requestBody.phone = currentUser.phone
	} else if (currentUser.telegram_id) {
		requestBody.telegram_id = currentUser.telegram_id
	} else {
		alert('Ошибка: не удалось определить пользователя')
		return
	}
	
	try {
		// Если это объединенное бронирование, отменяем все входящие в него бронирования
		if (isMerged && mergedIds.length > 1) {
			let allCancelled = true
			let totalRefunded = 0
			
			for (const id of mergedIds) {
				const response = await fetch(`/api/bookings/${id}/cancel`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody),
				})
				
				const data = await response.json()
				if (response.ok && data.success) {
					totalRefunded += data.refunded_coins || 0
				} else {
					allCancelled = false
					console.error(`Ошибка отмены бронирования ${id}:`, data.error)
				}
			}
			
			if (allCancelled) {
				// Обновляем баланс коинов
				await loadCoinsFromServer()
				// Обновляем список бронирований
				await refreshBookingsList()
				
				alert(`Все ${mergedIds.length} бронирования отменены. Возвращено ${totalRefunded} 🪙`)
			} else {
				alert('Некоторые бронирования не удалось отменить. Пожалуйста, обновите страницу.')
				await refreshBookingsList()
			}
			return
		}
		
		// Обычное бронирование (не объединенное)
		const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
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
		showRegistrationScreen()
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
document.addEventListener('DOMContentLoaded', function() {
	initApp()
	// Устанавливаем обработчик долгого нажатия на Санту после загрузки DOM
	setTimeout(setupAdminSecretAccess, 500)
})

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
window.loadCoinsFromServer = loadCoinsFromServer
window.checkIfSlotIsNow = checkIfSlotIsNow
window.cancelBooking = cancelBooking

// Глобальные переменные для выбранной недели, месяца и года
let selectedWeekNumber = null
let selectedMonth = null
let selectedYear = null

// Показать экран админки
function showAdminScreen() {
	console.log('🔐 Показываем экран админки')
	showScreen('admin')
	
	// Устанавливаем текущую дату по умолчанию
	const today = new Date()
	const day = today.getDate()
	
	// Определяем номер недели месяца
	if (day <= 7) {
		selectedWeekNumber = 1
	} else if (day <= 14) {
		selectedWeekNumber = 2
	} else if (day <= 21) {
		selectedWeekNumber = 3
	} else {
		selectedWeekNumber = 4
	}
	
	selectedMonth = today.getMonth() + 1 // getMonth() возвращает 0-11
	selectedYear = today.getFullYear()
	
	// Устанавливаем значения в селекты
	const monthSelect = document.getElementById('month-select')
	const yearSelect = document.getElementById('year-select')
	
	if (monthSelect) monthSelect.value = selectedMonth
	if (yearSelect) yearSelect.value = selectedYear
	
	// Выделяем выбранную неделю
	updateWeekButtons()
	updateWeekRange()
	
	// Загружаем статистику и начинаем автообновление онлайн пользователей
	loadAdminStats()
	startOnlineUsersAutoRefresh()
}

// Выбрать неделю
function selectWeek(weekNumber) {
	selectedWeekNumber = weekNumber
	updateWeekButtons()
	updateWeekRange()
	loadAdminStats()
}

// Обновить выделение кнопок недель
function updateWeekButtons() {
	const weekButtons = document.querySelectorAll('.week-btn')
	weekButtons.forEach(btn => {
		const weekNum = parseInt(btn.getAttribute('data-week'))
		if (weekNum === selectedWeekNumber) {
			btn.classList.remove('btn-secondary')
			btn.classList.add('btn-primary')
			btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
			btn.style.color = 'white'
			btn.style.border = 'none'
		} else {
			btn.classList.remove('btn-primary')
			btn.classList.add('btn-secondary')
			btn.style.background = ''
			btn.style.color = ''
			btn.style.border = ''
		}
	})
}

// Обновить отображение диапазона недели
function updateWeekRange() {
	const weekRange = document.getElementById('week-range')
	if (!weekRange || !selectedWeekNumber || !selectedMonth || !selectedYear) return
	
	// Вычисляем диапазон дат для выбранной недели
	const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
	
	let weekStartDay, weekEndDay
	if (selectedWeekNumber === 1) {
		weekStartDay = 1
		weekEndDay = Math.min(7, daysInMonth)
	} else if (selectedWeekNumber === 2) {
		weekStartDay = 8
		weekEndDay = Math.min(14, daysInMonth)
	} else if (selectedWeekNumber === 3) {
		weekStartDay = 15
		weekEndDay = Math.min(21, daysInMonth)
	} else { // week_number == 4
		weekStartDay = 22
		weekEndDay = daysInMonth
	}
	
	const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
	const monthName = monthNames[selectedMonth]
	
	weekRange.textContent = `${monthName} ${selectedYear}: ${weekStartDay} - ${weekEndDay} число`
}

// Обработчик изменения месяца или года
function onPeriodChange() {
	const monthSelect = document.getElementById('month-select')
	const yearSelect = document.getElementById('year-select')
	
	if (monthSelect) selectedMonth = parseInt(monthSelect.value)
	if (yearSelect) {
		const year = parseInt(yearSelect.value)
		if (year >= 2024 && year <= 2100) {
			selectedYear = year
		}
	}
	
	updateWeekRange()
	loadAdminStats()
}

// Обработчик изменения фильтра в админке
function onAdminFilterChange() {
	const filterSelect = document.getElementById('admin-filter')
	if (filterSelect) {
		adminFilter = filterSelect.value
		loadAdminStats()
	}
}

// Обработчик изменения поиска в админке
function onAdminSearchChange() {
	// Фильтруем уже загруженных пользователей
	filterAdminUsers()
}

// Переменная для хранения всех загруженных пользователей
let allAdminUsers = []

// Фильтрация пользователей по поисковому запросу
function filterAdminUsers() {
	const searchInput = document.getElementById('admin-search')
	const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : ''
	const container = document.getElementById('admin-users-container')
	
	if (!container) return
	
	// Если поиск пустой, показываем всех пользователей
	if (!searchQuery) {
		displayAdminUsers(allAdminUsers)
		return
	}
	
	// Фильтруем пользователей по логину
	const filteredUsers = allAdminUsers.filter(user => {
		const login = (user.school_login || '').toLowerCase()
		return login.includes(searchQuery)
	})
	
	displayAdminUsers(filteredUsers)
}

// Отображение пользователей в таблице
function displayAdminUsers(users) {
	const container = document.getElementById('admin-users-container')
	if (!container) return
	
	if (users.length === 0) {
		container.innerHTML = `
			<div class="card text-center" style="padding: 48px 24px;">
				<p class="text-gray" style="font-size: 15px;">Пользователи не найдены</p>
			</div>
		`
		return
	}
	
	// Получаем информацию о неделе из первого элемента (если есть)
	const weekInfo = users.length > 0 && users[0].weekInfo ? users[0].weekInfo : ''
	
	let html = `
		<div class="admin-stats-summary" style="margin-bottom: 20px; padding: 16px; background: rgba(102, 126, 234, 0.1); border-radius: 12px;">
			<div style="display: flex; justify-content: space-around; text-align: center;">
				<div>
					<div style="font-size: 24px; font-weight: 700; color: #667eea;">${users.length}</div>
					<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Пользователей</div>
				</div>
			</div>
			${weekInfo ? `<div style="text-align: center; margin-top: 12px; font-size: 13px; color: #6b7280; font-weight: 600;">${weekInfo}</div>` : ''}
		</div>
		<div style="overflow-x: auto;">
			<table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden;">
				<thead>
					<tr style="background: #f3f4f6;">
						<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase;">#</th>
						<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase;">Логин пира</th>
						<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase;">Телефон</th>
						<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase;">Telegram ID</th>
						<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase;">Общее время</th>
					</tr>
				</thead>
				<tbody>
	`
	
	users.forEach((user, index) => {
		html += `
			<tr style="border-bottom: 1px solid #e5e7eb;">
				<td style="padding: 12px; color: #111827; font-weight: 600;">${index + 1}</td>
				<td style="padding: 12px; color: #111827;">
					<span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${user.school_login === 'Не указан' ? '#f3f4f6' : '#dbeafe'}; color: ${user.school_login === 'Не указан' ? '#6b7280' : '#1e40af'};">
						${user.school_login}
					</span>
				</td>
				<td style="padding: 12px; color: #111827;">${user.phone}</td>
				<td style="padding: 12px; color: #111827;">
					<code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${user.telegram_id}</code>
				</td>
				<td style="padding: 12px; color: #111827;">
					<span style="display: inline-block; padding: 6px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
						${user.time_display}
					</span>
				</td>
			</tr>
		`
	})
	
	html += `
				</tbody>
			</table>
		</div>
	`
	
	container.innerHTML = html
	
	// Применяем stagger анимацию к карточкам бронирований
	setTimeout(() => {
		const bookingCards = container.querySelectorAll('.booking-card')
		bookingCards.forEach((card, index) => {
			card.style.animationDelay = `${index * 0.05}s`
		})
	}, 10)
}

// Загрузить онлайн пользователей
async function loadOnlineUsers() {
	const onlineContainer = document.getElementById('admin-online-users')
	const onlineList = document.getElementById('online-users-list')
	const onlineCount = document.getElementById('online-count')
	
	if (!onlineContainer || !onlineList || !onlineCount) return
	
	try {
		const response = await fetch('/api/admin/online-users')
		const data = await response.json()
		
		if (!data.success) {
			throw new Error(data.error || 'Ошибка загрузки онлайн пользователей')
		}
		
		const onlineUsers = data.online_users || []
		
		// Обновляем счетчик
		onlineCount.textContent = onlineUsers.length
		
		// Показываем/скрываем блок в зависимости от наличия онлайн пользователей
		if (onlineUsers.length === 0) {
			onlineContainer.style.display = 'none'
		} else {
			onlineContainer.style.display = 'block'
			
			// Формируем список онлайн пользователей
			onlineList.innerHTML = onlineUsers.map(user => {
				return `
					<div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
						<div>
							<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
								${user.school_login !== 'Не указан' ? user.school_login : 'Без логина'}
							</div>
							<div style="font-size: 12px; opacity: 0.9;">
								${user.phone} • ${user.time_ago}
							</div>
						</div>
						<div style="text-align: right;">
							<div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">
								🪙 ${user.coins}
							</div>
							<div style="width: 8px; height: 8px; background: #34d399; border-radius: 50%; display: inline-block; animation: pulse 2s infinite;"></div>
						</div>
					</div>
				`
			}).join('')
		}
	} catch (error) {
		console.error('Ошибка загрузки онлайн пользователей:', error)
		onlineContainer.style.display = 'none'
	}
}

// Загрузить статистику для админки
async function loadAdminStats() {
	const container = document.getElementById('admin-users-container')
	const loadingEl = document.getElementById('admin-loading')
	
	if (loadingEl) loadingEl.style.display = 'block'
	if (container) container.innerHTML = ''
	
	// Загружаем онлайн пользователей
	loadOnlineUsers()
	
	// Проверяем, что все параметры установлены
	if (!selectedWeekNumber || !selectedMonth || !selectedYear) {
		console.warn('Не все параметры недели установлены')
		if (loadingEl) loadingEl.style.display = 'none'
		return
	}
	
	// Получаем текущий фильтр
	const filterSelect = document.getElementById('admin-filter')
	const currentFilter = filterSelect ? filterSelect.value : 'all'
	
	try {
		const url = `/api/admin/users-stats?week_number=${selectedWeekNumber}&month=${selectedMonth}&year=${selectedYear}&filter=${currentFilter}`
		const response = await fetch(url)
		const data = await response.json()
		
		if (!data.success) {
			throw new Error(data.error || 'Ошибка загрузки данных')
		}
		
		const users = data.users || []
		
		if (loadingEl) loadingEl.style.display = 'none'
		
		// Сохраняем всех пользователей для поиска
		allAdminUsers = users.map(user => ({
			...user,
			weekInfo: data.week_start_day && data.week_end_day && data.month_name 
				? `${data.month_name} ${data.year}: ${data.week_start_day} - ${data.week_end_day} число`
				: ''
		}))
		
		// Отображаем пользователей (с учетом поиска, если есть)
		filterAdminUsers()
	} catch (error) {
		console.error('Ошибка загрузки данных админки:', error)
		if (loadingEl) loadingEl.style.display = 'none'
		if (container) {
			container.innerHTML = `
				<div class="card text-center" style="padding: 48px 24px;">
					<p class="text-gray" style="font-size: 15px; color: #ef4444;">Ошибка загрузки данных: ${error.message}</p>
				</div>
			`
		}
	}
}

// Выйти из админ-панели
function exitAdmin() {
	console.log('🚪 Выход из админ-панели')
	
	// Останавливаем автообновление онлайн пользователей
	stopOnlineUsersAutoRefresh()
	
	// Очищаем сохраненный профиль
	sessionStorage.removeItem('currentProfile')
	
	// Очищаем данные админа, чтобы вернуться на экран регистрации
	if (currentUser) {
		currentUser.school_login = null
		currentUser.phone = null
	}
	
	// Показываем экран регистрации с вкладками (вход/регистрация)
	showRegistrationScreen()
}

// Автообновление онлайн пользователей каждые 10 секунд
let onlineUsersInterval = null

function startOnlineUsersAutoRefresh() {
	// Останавливаем предыдущий интервал, если есть
	if (onlineUsersInterval) {
		clearInterval(onlineUsersInterval)
	}
	
	// Загружаем сразу
	loadOnlineUsers()
	
	// Устанавливаем автообновление каждые 10 секунд
	onlineUsersInterval = setInterval(loadOnlineUsers, 10000)
}

function stopOnlineUsersAutoRefresh() {
	if (onlineUsersInterval) {
		clearInterval(onlineUsersInterval)
		onlineUsersInterval = null
	}
}

// Функция для обработки долгого нажатия на Санту (5 секунд для доступа к админке)
// Полностью скрытая активация - без визуальных эффектов
function setupAdminSecretAccess() {
	const santaDecoration = document.getElementById('santa-decoration')
	if (!santaDecoration) return
	
	let pressTimer = null
	let pressStartTime = null
	const PRESS_DURATION = 5000 // 5 секунд
	const ADMIN_PASSWORD = '1406'
	
	// Функция для открытия модального окна с паролем
	function showAdminPasswordModal() {
		const modal = document.getElementById('admin-password-modal')
		if (modal) {
			modal.style.display = 'flex'
			const passwordInput = document.getElementById('admin-password-input')
			if (passwordInput) {
				passwordInput.value = ''
				passwordInput.focus()
			}
		}
	}
	
	// Функция для закрытия модального окна
	function closeAdminPasswordModal() {
		const modal = document.getElementById('admin-password-modal')
		if (modal) {
			modal.style.display = 'none'
		}
		const errorDiv = document.getElementById('admin-password-error')
		if (errorDiv) {
			errorDiv.style.display = 'none'
		}
	}
	
	// Функция для проверки пароля
	function checkAdminPassword() {
		const passwordInput = document.getElementById('admin-password-input')
		const errorDiv = document.getElementById('admin-password-error')
		
		if (!passwordInput) return
		
		const enteredPassword = passwordInput.value.trim()
		
		if (enteredPassword === ADMIN_PASSWORD) {
			// Пароль правильный - закрываем модальное окно и открываем админку
			closeAdminPasswordModal()
			showAdminScreen()
		} else {
			// Пароль неправильный - показываем ошибку
			if (errorDiv) {
				errorDiv.style.display = 'block'
			}
			passwordInput.value = ''
			passwordInput.focus()
		}
	}
	
	// Экспортируем функции для использования в HTML
	window.closeAdminPasswordModal = closeAdminPasswordModal
	window.checkAdminPassword = checkAdminPassword
	
	// Для мобильных устройств (touch)
	santaDecoration.addEventListener('touchstart', function(e) {
		e.preventDefault()
		pressStartTime = Date.now()
		pressTimer = setTimeout(function() {
			const duration = Date.now() - pressStartTime
			if (duration >= PRESS_DURATION) {
				console.log('🔐 Долгое нажатие на Санту обнаружено')
				showAdminPasswordModal()
			}
		}, PRESS_DURATION)
	})
	
	santaDecoration.addEventListener('touchend', function(e) {
		e.preventDefault()
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
		pressStartTime = null
	})
	
	santaDecoration.addEventListener('touchcancel', function(e) {
		e.preventDefault()
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
		pressStartTime = null
	})
	
	// Для десктопов (mouse)
	santaDecoration.addEventListener('mousedown', function(e) {
		pressStartTime = Date.now()
		pressTimer = setTimeout(function() {
			const duration = Date.now() - pressStartTime
			if (duration >= PRESS_DURATION) {
				console.log('🔐 Долгое нажатие на Санту обнаружено')
				showAdminPasswordModal()
			}
		}, PRESS_DURATION)
	})
	
	santaDecoration.addEventListener('mouseup', function(e) {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
		pressStartTime = null
	})
	
	santaDecoration.addEventListener('mouseleave', function(e) {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
		pressStartTime = null
	})
	
	// Обработчик нажатия Enter в поле пароля
	document.addEventListener('keydown', function(e) {
		const modal = document.getElementById('admin-password-modal')
		if (modal && modal.style.display === 'flex' && e.key === 'Enter') {
			checkAdminPassword()
		}
	})
}

// Экспортируем функции
window.showAdminScreen = showAdminScreen
window.loadAdminStats = loadAdminStats
window.loadOnlineUsers = loadOnlineUsers
window.selectWeek = selectWeek
window.onPeriodChange = onPeriodChange
window.onAdminFilterChange = onAdminFilterChange
window.onAdminSearchChange = onAdminSearchChange
window.exitAdmin = exitAdmin
window.showLoginScreen = showLoginScreen
window.loginUser = loginUser
window.switchToLogin = switchToLogin
window.switchToRegister = switchToRegister
window.registerUser = registerUser
window.switchToRegisterAndClosePrompt = switchToRegisterAndClosePrompt
window.closeRegistrationPrompt = closeRegistrationPrompt