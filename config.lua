Config = {}

-- Предмет для открытия книги
Config.Item = 'lawbook'

-- Команды (можно отключить если только через предмет)
Config.CommandEnabled = true  -- true = команды работают, false = только предмет
Config.Command = 'lawbook'
Config.CommandAliases = {'laws', 'constitution', 'zakony'}

-- Клавиша для открытия (оставьте пустым '' чтобы отключить)
Config.OpenKey = '' -- Отключено, только предмет

-- Whitelist для редактирования (ОСТАВЬТЕ ПУСТЫМ ДЛЯ ТЕСТА)
Config.EditWhitelist = {
    'license:1234567890abcdef1234567890abcdef12345678',
}

-- Вкладки книги
Config.Tabs = {
    {
        id = 'laws',
        title = 'ЗАКОНЫ',
        file = 'laws.json',
        icon = '⚖️'
    },
    {
        id = 'constitution',
        title = 'КОНСТИТУЦИЯ',
        file = 'constitution.json',
        icon = '📜'
    }
}

-- Настройки UI
Config.UITitles = {
    bookTitle = 'СВОД ЗАКОНОВ',
    searchPlaceholder = 'Поиск...',
    closeButton = 'Закрыть',
    saveButton = 'Сохранить',
    cancelButton = 'Отмена',
    addChapter = 'Добавить главу',
    addArticle = 'Добавить статью',
    addPoint = 'Добавить пункт',
    editMode = 'Режим редактирования',
    noResults = 'Ничего не найдено',
    page = 'Страница'
}

-- Анимация чтения
Config.ReadingAnimation = {
    enabled = false,
    dict = 'amb_work@world_human_clipboard@male@idle_a',
    anim = 'idle_a'
}

-- Debug режим
Config.Debug = true