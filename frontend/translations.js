// frontend/translations.js
// Система переводов для мини-приложения

const translations = {
	ru: {
		// Общие
		loading: 'Загрузка',
		back: 'Назад',
		open: 'Открыть',
		cancel: 'Отмена',
		continue: 'Продолжить',
		confirm: 'Подтвердить',
		next: 'Далее',
		close: 'Закрыть',
		
		// Навигация
		floors: 'Этажи',
		bookings: 'Бронирования',
		myBookings: 'Мои бронирования',
		
		// Экраны
		selectFloor: 'Выберите этаж',
		floor2: '2 Этаж',
		floor3: '3 Этаж',
		floor: 'Этаж',
		floor2Description: '3 скайпницы',
		floor2Details: 'До 4 человек • Шумоизоляция',
		floor3Description: '6 скайпниц + 3 переговорки',
		floor3Details: 'Для созвонов и командных встреч',
		
		// Регистрация
		welcome: '👋 Добро пожаловать!',
		completeRegistration: 'Завершите регистрацию',
		registrationDescription: 'Для бронирования комнат укажите ваш школьный логин и номер телефона',
		schoolLogin: 'Школьный логин *',
		phoneNumber: 'Номер телефона *',
		receivedCoins: 'Вы получили 100 коинов за регистрацию!',
		
		// Комнаты
		loadingRooms: 'Загрузка комнат',
		available: 'Свободна',
		busy: 'Занята',
		busyNow: 'Занята сейчас',
		skypbox: 'Скайпница',
		meeting: 'Переговорка',
		
		// Бронирование
		selectDate: 'Выберите дату',
		selectTime: 'Время начала',
		duration: 'Длительность',
		hour: 'час',
		hours: 'часа',
		confirmBooking: 'Подтвердить бронирование',
		bookingConfirmed: 'Бронирование подтверждено!',
		bookingCancelled: 'Бронирование отменено!',
		cancelBooking: 'Отменить бронирование',
		cancelBookingConfirm: 'Вы уверены, что хотите отменить это бронирование? Коины будут возвращены на ваш баланс.',
		refunded: 'Возвращено',
		noBookings: 'У вас пока нет бронирований',
		
		// Статусы
		free: 'Свободно',
		busyStatus: 'Занято',
		past: 'Прошло',
		confirmed: '✓ Подтверждено',
		cancelled: '✕ Отменено',
		
		// Легенда
		legend: 'Легенда:',
		
		// Ошибки
		error: 'Ошибка',
		authError: 'Ошибка авторизации',
		connectionError: 'Ошибка соединения с сервером',
		reload: 'Перезагрузить',
		
		// Профиль
		editProfile: 'Редактировать профиль',
		coins: '🪙',
		
		// Время
		today: 'Сегодня',
		tomorrow: 'Завтра',
		busyToday: '📅 Занято сегодня:',
		
		// Дополнительно
		selectRoom: 'Выберите комнату',
		roomDetails: 'Детали комнаты',
		price: 'Цена',
		capacity: 'Вместимость',
		persons: 'человек',
		noRooms: 'Нет комнат на этом этаже',
		busyNow: 'Занята сейчас',
		busyNowBadge: '🔴 Занята сейчас',
		busyToday: '📅 Занято сегодня:',
		bookedBy: 'Забронировано',
		roomId: 'ID',
		cancelInfo: 'Отмена возможна только за 1 час до начала',
		refundedCoins: 'Возвращено',
		bookingId: 'ID бронирования',
		date: 'Дата',
		time: 'Время',
		room: 'Комната',
		status: 'Статус',
		coinsPerHour: 'коинов/час',
		upTo: 'До',
		soundproofing: 'Шумоизоляция',
		skypboxes: 'Скайпницы',
		meetingRooms: 'Переговорки',
		skypboxPrice: 'Скайпницы:',
		meetingPrice: 'Переговорки:',
		coins: 'коинов',
		selectDate: 'Выберите дату',
		selectStartTime: 'Выберите время начала',
		selectDuration: 'Выберите длительность',
		summary: 'Сводка',
		bookingSummary: 'Сводка бронирования',
		totalCost: 'Общая стоимость',
		confirmBookingBtn: 'Подтвердить бронирование',
		bookingSuccess: 'Бронирование успешно создано!',
		insufficientCoins: 'Недостаточно коинов',
		timeSlotBusy: 'Это время уже занято',
		invalidTime: 'Неверное время',
		pastTime: 'Нельзя бронировать прошедшее время',
		pastDateError: 'Нельзя выбрать прошедшую дату! Пожалуйста, выберите сегодня или будущую дату.',
		invalidDate: 'Неверная дата',
		invalidPhone: 'Неверный формат телефона',
		phoneFormat: 'Используйте формат: +998-XX-XXX-XX-XX',
		loginRequired: 'Требуется школьный логин',
		phoneRequired: 'Требуется номер телефона',
		registrationRequired: 'Для бронирования необходимо завершить регистрацию',
		
		// Дополнительные сообщения
		enterSchoolLogin: 'Введите школьный логин!',
		enterPhoneNumber: 'Введите номер телефона!',
		invalidPhoneFormat: 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-XX-XXX-XX-XX)',
		errorPrefix: 'Ошибка: ',
		networkError: 'Ошибка сети',
		bookingModuleError: 'Ошибка: модуль бронирования не загружен. Пожалуйста, обновите страницу.',
		invalidRoomId: 'Ошибка: неверный ID комнаты',
		roomNotFound: 'Ошибка: комната не найдена',
		roomNotFoundRefresh: 'Ошибка: комната не найдена. Попробуйте обновить страницу.',
		errorLoadingData: 'Ошибка загрузки данных: ',
		errorLoadingRoom: 'Ошибка загрузки данных комнаты. Проверьте подключение к интернету.',
		unknownError: 'неизвестная ошибка',
		free: 'Бесплатно',
		user: 'Пользователь',
		testUser: 'Тестовый',
		authErrorPrefix: 'Ошибка авторизации: ',
		confirmBookingTitle: 'Подтвердите бронирование',
		yourBalance: 'Ваш баланс:',
		now: 'Сейчас',
		errorLoadingSchedule: 'Ошибка загрузки расписания',
		loadingSchedule: 'Загружаем расписание',
		confirmBookingBtnText: 'Подтвердить',
		
		// Дни недели
		dayNames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
		
		// Названия комнат
		skypbox1: 'Скайпница 1',
		skypbox2: 'Скайпница 2',
		skypbox3: 'Скайпница 3',
		skypbox4: 'Скайпница 4',
		skypbox5: 'Скайпница 5',
		skypbox6: 'Скайпница 6',
		meeting1: 'Переговорка 1',
		meeting2: 'Переговорка 2',
		meeting3: 'Переговорка 3',
		
		// Описания комнат
		capacity4: 'Вместимость 4 человека',
		capacity8: 'Вместимость до 8 человек',
		fullSoundproofing: 'Полная шумоизоляция',
		comfortableMeeting: 'Комфортная переговорная комната',
		projectorBoard: 'Проектор и доска для презентаций',
		idealForMeetings: 'Идеально для встреч и обсуждений',
		idealForCalls: 'Идеальна для созвонов и работы в тишине',
		comfortableChair: 'Комфортное кресло и стол',
		importantCalls: 'Для важных звонков и фокусировки',
		equippedOutlets: 'Оснащена розетками и USB',
		privateSpace: 'Уединенное пространство для работы',
		goodLighting: 'Хорошее освещение и вентиляция',
		quietZone: 'Тихая зона для работы',
		standardBooth: 'Стандартная кабинка на 3 этаже',
		cozyWorkArea: 'Уютная рабочая зона',
		individualWork: 'Для индивидуальной работы',
		isolatedSpace: 'Изолированное пространство',
		idealForInterviews: 'Идеально для интервью',
		comfortableBooth: 'Комфортная кабинка',
		quietWorkZone: 'Тихая рабочая зона',
		
		// Дополнительные сообщения об ошибках
		topUpBalance: 'Пополните баланс или выберите более дешевую комнату.',
		authErrorReload: '👤 Ошибка авторизации.\n\nПожалуйста, перезагрузите страницу или откройте приложение через бота Telegram.',
		roomNotFoundDetails: '🚪 Комната не найдена.\n\nВозможно, она была удалена или деактивирована.',
		changeLanguageTitle: 'Изменить язык',
		more: 'еще',
		networkErrorFull: '🌐 Ошибка сети.\n\nПроверьте подключение к интернету и попробуйте снова.',
	},
	
	uz: {
		// Общие
		loading: 'Yuklanmoqda',
		back: 'Orqaga',
		open: 'Ochish',
		cancel: 'Bekor qilish',
		continue: 'Davom etish',
		confirm: 'Tasdiqlash',
		next: 'Keyingi',
		close: 'Yopish',
		
		// Навигация
		floors: 'Qavatlar',
		bookings: 'Bronlar',
		myBookings: 'Mening bronlarim',
		
		// Экраны
		selectFloor: 'Qavatni tanlang',
		floor2: '2-qavat',
		floor3: '3-qavat',
		floor: 'qavat',
		floor2Description: '3 ta skayp xonasi',
		floor2Details: '4 kishigacha • Shovqin izolyatsiyasi',
		floor3Description: '6 ta skayp xonasi + 3 ta majlis xonasi',
		floor3Details: 'Qo‘ng‘iroqlar va jamoaviy uchrashuvlar uchun',
		
		// Регистрация
		welcome: '👋 Xush kelibsiz!',
		completeRegistration: 'Ro\'yxatdan o\'tishni yakunlang',
		registrationDescription: 'Xona bron qilish uchun maktab login va telefon raqamingizni kiriting',
		schoolLogin: 'Maktab logini *',
		phoneNumber: 'Telefon raqami *',
		receivedCoins: 'Ro\'yxatdan o\'tish uchun 100 tanga oldingiz!',
		
		// Комнаты
		loadingRooms: 'Xonalar yuklanmoqda',
		available: 'Bo\'sh',
		busy: 'Band',
		busyNow: 'Hozir band',
		skypbox: 'Skayp xonasi',
		meeting: 'Majlis xonasi',
		
		// Бронирование
		selectDate: 'Sanani tanlang',
		selectTime: 'Boshlanish vaqti',
		duration: 'Davomiyligi',
		hour: 'soat',
		hours: 'soat',
		confirmBooking: 'Bronni tasdiqlash',
		bookingConfirmed: 'Bron tasdiqlandi!',
		bookingCancelled: 'Bron bekor qilindi!',
		cancelBooking: 'Bronni bekor qilish',
		cancelBookingConfirm: 'Bu bronni bekor qilmoqchimisiz? Tangalar balansingizga qaytariladi.',
		refunded: 'Qaytarildi',
		noBookings: 'Sizda hali bronlar yo\'q',
		
		// Статусы
		free: 'Bo\'sh',
		busyStatus: 'Band',
		past: 'O\'tgan',
		confirmed: '✓ Tasdiqlangan',
		cancelled: '✕ Bekor qilingan',
		
		// Легенда
		legend: 'Leyenda:',
		
		// Ошибки
		error: 'Xatolik',
		authError: 'Autentifikatsiya xatosi',
		connectionError: 'Server bilan aloqa xatosi',
		reload: 'Qayta yuklash',
		
		// Профиль
		editProfile: 'Profilni tahrirlash',
		coins: '🪙',
		
		// Время
		today: 'Bugun',
		tomorrow: 'Ertaga',
		busyToday: '📅 Bugun band:',
		
		// Дополнительно
		selectRoom: 'Xonani tanlang',
		roomDetails: 'Xona tafsilotlari',
		price: 'Narx',
		capacity: 'Sig\'imi',
		persons: 'kishi',
		noRooms: 'Bu qavatda xonalar yo\'q',
		busyNow: 'Hozir band',
		busyNowBadge: '🔴 Hozir band',
		busyToday: '📅 Bugun band:',
		bookedBy: 'Bron qilingan',
		roomId: 'ID',
		cancelInfo: 'Bekor qilish faqat boshlanishidan 1 soat oldin mumkin',
		refundedCoins: 'Qaytarildi',
		bookingId: 'Bron ID',
		date: 'Sana',
		time: 'Vaqt',
		room: 'Xona',
		status: 'Holat',
		coinsPerHour: 'tanga/soat',
		upTo: 'Gacha',
		soundproofing: 'Shovqin izolyatsiyasi',
		skypboxes: 'Skayp xonalari',
		meetingRooms: 'Majlis xonalari',
		skypboxPrice: 'Skayp xonalari:',
		meetingPrice: 'Majlis xonalari:',
		coins: 'tanga',
		selectDate: 'Sanani tanlang',
		selectStartTime: 'Boshlanish vaqtini tanlang',
		selectDuration: 'Davomiylikni tanlang',
		summary: 'Xulosa',
		bookingSummary: 'Bron xulosasi',
		totalCost: 'Jami narx',
		confirmBookingBtn: 'Bronni tasdiqlash',
		bookingSuccess: 'Bron muvaffaqiyatli yaratildi!',
		insufficientCoins: 'Tangalar yetarli emas',
		timeSlotBusy: 'Bu vaqt allaqachon band',
		invalidTime: 'Noto\'g\'ri vaqt',
		pastTime: 'O\'tgan vaqtni bron qilib bo\'lmaydi',
		pastDateError: 'O\'tgan sanani tanlab bo\'lmaydi! Iltimos, bugun yoki kelajakdagi sanani tanlang.',
		invalidDate: 'Noto\'g\'ri sana',
		invalidPhone: 'Noto\'g\'ri telefon formati',
		phoneFormat: 'Formatdan foydalaning: +998-XX-XXX-XX-XX',
		loginRequired: 'Maktab logini talab qilinadi',
		phoneRequired: 'Telefon raqami talab qilinadi',
		registrationRequired: 'Bron qilish uchun ro\'yxatdan o\'tishni yakunlash kerak',
		
		// Дополнительные сообщения
		enterSchoolLogin: 'Maktab loginini kiriting!',
		enterPhoneNumber: 'Telefon raqamini kiriting!',
		invalidPhoneFormat: 'Noto\'g\'ri telefon formati. Formatdan foydalaning: +998-XX-XXX-XX-XX (masalan: +998-XX-XXX-XX-XX)',
		errorPrefix: 'Xatolik: ',
		networkError: 'Tarmoq xatosi',
		bookingModuleError: 'Xatolik: bron moduli yuklanmadi. Iltimos, sahifani yangilang.',
		invalidRoomId: 'Xatolik: noto\'g\'ri xona ID',
		roomNotFound: 'Xatolik: xona topilmadi',
		roomNotFoundRefresh: 'Xatolik: xona topilmadi. Iltimos, sahifani yangilab ko\'ring.',
		errorLoadingData: 'Ma\'lumotlarni yuklashda xatolik: ',
		errorLoadingRoom: 'Xona ma\'lumotlarini yuklashda xatolik. Internet ulanishini tekshiring.',
		unknownError: 'noma\'lum xatolik',
		free: 'Bepul',
		user: 'Foydalanuvchi',
		testUser: 'Test',
		authErrorPrefix: 'Autentifikatsiya xatosi: ',
		confirmBookingTitle: 'Bronni tasdiqlang',
		yourBalance: 'Sizning balansingiz:',
		now: 'Hozir',
		errorLoadingSchedule: 'Jadvalni yuklashda xatolik',
		loadingSchedule: 'Jadval yuklanmoqda',
		confirmBookingBtnText: 'Tasdiqlash',
		
		// Дни недели
		dayNames: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
		
		// Названия комнат
		skypbox1: 'Skayp xonasi 1',
		skypbox2: 'Skayp xonasi 2',
		skypbox3: 'Skayp xonasi 3',
		skypbox4: 'Skayp xonasi 4',
		skypbox5: 'Skayp xonasi 5',
		skypbox6: 'Skayp xonasi 6',
		meeting1: 'Majlis xonasi 1',
		meeting2: 'Majlis xonasi 2',
		meeting3: 'Majlis xonasi 3',
		
		// Описания комнат
		capacity4: 'Sig\'imi 4 kishi',
		capacity8: '8 kishigacha sig\'im',
		fullSoundproofing: 'To\'liq shovqin izolyatsiyasi',
		comfortableMeeting: 'Qulay majlis xonasi',
		projectorBoard: 'Proyektor va taqdimot doskasi',
		idealForMeetings: 'Uchrashuvlar va muhokamalar uchun ideal',
		idealForCalls: 'Qo\'ng\'iroqlar va jimlikda ishlash uchun ideal',
		comfortableChair: 'Qulay stul va stol',
		importantCalls: 'Muhim qo\'ng\'iroqlar va fokuslash uchun',
		equippedOutlets: 'Rozetkalar va USB bilan jihozlangan',
		privateSpace: 'Yakka ishlash uchun yakkalanib qolgan joy',
		goodLighting: 'Yaxshi yoritish va ventilyatsiya',
		quietZone: 'Ishlash uchun jim zonasi',
		standardBooth: '3-qavatdagi standart kabina',
		cozyWorkArea: 'Qulay ish maydoni',
		individualWork: 'Yakka ishlash uchun',
		isolatedSpace: 'Ajratilgan joy',
		idealForInterviews: 'Intervyular uchun ideal',
		comfortableBooth: 'Qulay kabina',
		quietWorkZone: 'Jim ish zonasi',
		
		// Дополнительные сообщения об ошибках
		topUpBalance: 'Balansni to\'ldiring yoki arzonroq xonani tanlang.',
		authErrorReload: '👤 Autentifikatsiya xatosi.\n\nIltimos, sahifani yangilang yoki ilovani Telegram bot orqali oching.',
		roomNotFoundDetails: '🚪 Xona topilmadi.\n\nEhtimol, u o\'chirilgan yoki deaktivatsiya qilingan.',
		changeLanguageTitle: 'Tilni o\'zgartirish',
		more: 'yana',
		networkErrorFull: '🌐 Tarmoq xatosi.\n\nInternet ulanishini tekshiring va qayta urinib ko\'ring.',
		
		cost: 'Narx',
		bookingDate: 'Bron sanasi',
		insufficientCoinsMsg: 'Tangalar yetarli emas!',
		needed: 'Kerak',
		youHave: 'Sizda',
		missing: 'Yetmayapti',
		bookingSuccessMsg: 'Bron muvaffaqiyatli yaratildi!',
		bookingDetails: 'Bron tafsilotlari',
		bookingTime: 'Vaqt',
		bookingCost: 'Narx',
		bookingIdLabel: 'Bron ID',
		pastTimeError: 'O\'tgan vaqtni bron qilib bo\'lmaydi! Tugash vaqti allaqachon o\'tgan yoki joriy vaqtga juda yaqin.',
		notAuthorized: 'Xatolik: foydalanuvchi autentifikatsiya qilinmagan',
		roomNotSelected: 'Xatolik: xona tanlanmagan',
		selectDateAndTime: 'Xatolik: sana va vaqtni tanlang',
		invalidHours: 'Xatolik: noto\'g\'ri soatlar soni (1 dan 24 gacha bo\'lishi kerak)',
		timeAlreadyBooked: '⏰ Bu vaqt allaqachon boshqa foydalanuvchi tomonidan band qilingan.\n\nIltimos, boshqa vaqt yoki boshqa xonani tanlang.',
		unknownError: 'Noma\'lum xatolik',
		invalidResponse: 'Server noto\'g\'ri javob qaytardi',
	}
}

// Текущий язык (по умолчанию русский)
let currentLanguage = localStorage.getItem('app_language') || 'ru'

// Функция для получения перевода
function t(key) {
	return translations[currentLanguage]?.[key] || translations.ru[key] || key
}

// Функция для переключения языка
function setLanguage(lang) {
	if (translations[lang]) {
		currentLanguage = lang
		localStorage.setItem('app_language', lang)
		updateAllTexts()
	}
}

// Функция для обновления всех текстов на странице
function updateAllTexts() {
	// Обновляем тексты в HTML элементах с data-i18n атрибутом
	document.querySelectorAll('[data-i18n]').forEach(element => {
		const key = element.getAttribute('data-i18n')
		element.textContent = t(key)
	})
	
	// Обновляем тексты этажей с data-i18n-floor атрибутом
	document.querySelectorAll('[data-i18n-floor]').forEach(element => {
		const floorNum = element.getAttribute('data-i18n-floor')
		const floorKey = `floor${floorNum}`
		element.textContent = `🏢 ${t(floorKey)}`
	})
	
	// Обновляем placeholder'ы
	document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
		const key = element.getAttribute('data-i18n-placeholder')
		element.placeholder = t(key)
	})
	
	// Обновляем title атрибуты
	document.querySelectorAll('[data-i18n-title]').forEach(element => {
		const key = element.getAttribute('data-i18n-title')
		element.title = t(key)
	})
	
	// Вызываем функции обновления для динамического контента
	if (typeof updateDynamicTexts === 'function') {
		updateDynamicTexts()
	}
}

// Экспортируем в window для глобального доступа
window.translations = translations
window.t = t
window.setLanguage = setLanguage
window.currentLanguage = currentLanguage
window.updateAllTexts = updateAllTexts

