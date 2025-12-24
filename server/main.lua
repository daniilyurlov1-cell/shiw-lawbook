local RSGCore = nil
local lawData = {}

-- Инициализация
Citizen.CreateThread(function()
    Citizen.Wait(500)
    
    -- Получаем RSG Core
    if GetResourceState('rsg-core') == 'started' then
        RSGCore = exports['rsg-core']:GetCoreObject()
        print('[RSG-Lawbook] RSG Core loaded!')
        
        -- Регистрация использования предмета
        RSGCore.Functions.CreateUseableItem('lawbook', function(source, item)
            local Player = RSGCore.Functions.GetPlayer(source)
            if Player then
                print('[RSG-Lawbook] Player ' .. source .. ' used lawbook item')
                TriggerClientEvent('rsg-lawbook:client:openFromItem', source)
            end
        end)
        print('[RSG-Lawbook] Lawbook item registered!')
    else
        print('[RSG-Lawbook] WARNING: RSG Core not found!')
    end
    
    -- Загрузка данных
    LoadAllData()
    print('[RSG-Lawbook] Server started!')
end)

-- Загрузка всех данных
function LoadAllData()
    for _, tab in ipairs(Config.Tabs) do
        local filePath = 'data/' .. tab.file
        local fileContent = LoadResourceFile(GetCurrentResourceName(), filePath)
        
        if fileContent and fileContent ~= '' then
            local decoded = json.decode(fileContent)
            if decoded then
                lawData[tab.id] = decoded
                print('[RSG-Lawbook] Loaded: ' .. tab.file)
            else
                print('[RSG-Lawbook] ERROR decoding: ' .. tab.file)
                lawData[tab.id] = CreateEmptyData(tab.title)
            end
        else
            print('[RSG-Lawbook] File not found, creating: ' .. tab.file)
            lawData[tab.id] = CreateEmptyData(tab.title)
            SaveDataToFile(tab.id)
        end
    end
end

function CreateEmptyData(title)
    return {
        title = title,
        chapters = {}
    }
end

-- Сохранение данных в файл
function SaveDataToFile(tabId)
    for _, tab in ipairs(Config.Tabs) do
        if tab.id == tabId then
            local filePath = 'data/' .. tab.file
            local jsonContent = json.encode(lawData[tabId], {indent = true})
            local success = SaveResourceFile(GetCurrentResourceName(), filePath, jsonContent, -1)
            print('[RSG-Lawbook] Saved ' .. tab.file .. ': ' .. tostring(success))
            break
        end
    end
end

-- Проверка прав редактирования
function CanPlayerEdit(source)
    local identifiers = GetPlayerIdentifiers(source)
    
    for _, id in ipairs(identifiers) do
        for _, whitelisted in ipairs(Config.EditWhitelist) do
            if id == whitelisted then
                print('[RSG-Lawbook] Player ' .. source .. ' can edit (whitelisted)')
                return true
            end
        end
    end
    
    -- Если whitelist пустой, разрешаем всем (для тестирования)
    if #Config.EditWhitelist == 0 then
        print('[RSG-Lawbook] Whitelist empty, allowing edit')
        return true
    end
    
    return false
end

-- Запрос данных от клиента
RegisterNetEvent('rsg-lawbook:server:requestData', function()
    local source = source
    local canEdit = CanPlayerEdit(source)
    
    print('[RSG-Lawbook] Data requested by player ' .. source)
    
    TriggerClientEvent('rsg-lawbook:client:receiveData', source, lawData, canEdit)
end)

-- Вспомогательная функция
function TableLength(t)
    local count = 0
    for _ in pairs(t) do count = count + 1 end
    return count
end

-- Сохранение данных
RegisterNetEvent('rsg-lawbook:server:saveData', function(tabId, content)
    local source = source
    
    if not CanPlayerEdit(source) then
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Нет прав!', 'error')
        return
    end
    
    lawData[tabId] = content
    SaveDataToFile(tabId)
    
    TriggerClientEvent('rsg-lawbook:client:updateData', -1, tabId, lawData[tabId])
    TriggerClientEvent('rsg-lawbook:client:notify', source, 'Сохранено!', 'success')
end)

-- Добавление главы
RegisterNetEvent('rsg-lawbook:server:addChapter', function(tabId, chapter)
    local source = source
    print('[RSG-Lawbook] addChapter from ' .. source)
    
    if not CanPlayerEdit(source) then
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Нет прав!', 'error')
        return
    end
    
    if not lawData[tabId] then
        lawData[tabId] = CreateEmptyData(tabId)
    end
    
    if not lawData[tabId].chapters then
        lawData[tabId].chapters = {}
    end
    
    table.insert(lawData[tabId].chapters, {
        title = chapter.title or "Новая глава",
        articles = {}
    })
    
    SaveDataToFile(tabId)
    TriggerClientEvent('rsg-lawbook:client:updateData', -1, tabId, lawData[tabId])
    TriggerClientEvent('rsg-lawbook:client:notify', source, 'Глава добавлена!', 'success')
end)

-- Добавление статьи
RegisterNetEvent('rsg-lawbook:server:addArticle', function(tabId, chapterIndex, article)
    local source = source
    print('[RSG-Lawbook] addArticle from ' .. source)
    
    if not CanPlayerEdit(source) then
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Нет прав!', 'error')
        return
    end
    
    if lawData[tabId] and lawData[tabId].chapters and lawData[tabId].chapters[chapterIndex] then
        if not lawData[tabId].chapters[chapterIndex].articles then
            lawData[tabId].chapters[chapterIndex].articles = {}
        end
        
        table.insert(lawData[tabId].chapters[chapterIndex].articles, {
            title = article.title or "Новая статья",
            content = article.content or '',
            points = {}
        })
        
        SaveDataToFile(tabId)
        TriggerClientEvent('rsg-lawbook:client:updateData', -1, tabId, lawData[tabId])
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Статья добавлена!', 'success')
    else
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Глава не найдена!', 'error')
    end
end)

-- Добавление пункта
RegisterNetEvent('rsg-lawbook:server:addPoint', function(tabId, chapterIndex, articleIndex, point)
    local source = source
    print('[RSG-Lawbook] addPoint from ' .. source)
    
    if not CanPlayerEdit(source) then
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Нет прав!', 'error')
        return
    end
    
    if lawData[tabId] and 
       lawData[tabId].chapters and 
       lawData[tabId].chapters[chapterIndex] and
       lawData[tabId].chapters[chapterIndex].articles and
       lawData[tabId].chapters[chapterIndex].articles[articleIndex] then
        
        if not lawData[tabId].chapters[chapterIndex].articles[articleIndex].points then
            lawData[tabId].chapters[chapterIndex].articles[articleIndex].points = {}
        end
        
        table.insert(lawData[tabId].chapters[chapterIndex].articles[articleIndex].points, {
            text = point.text or "Новый пункт",
            penalty = point.penalty or ''
        })
        
        SaveDataToFile(tabId)
        TriggerClientEvent('rsg-lawbook:client:updateData', -1, tabId, lawData[tabId])
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Пункт добавлен!', 'success')
    else
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Статья не найдена!', 'error')
    end
end)

-- Удаление элемента
RegisterNetEvent('rsg-lawbook:server:deleteItem', function(tabId, path)
    local source = source
    
    if not CanPlayerEdit(source) then
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Нет прав!', 'error')
        return
    end
    
    local success = false
    
    if path.type == 'chapter' and lawData[tabId].chapters[path.chapterIndex] then
        table.remove(lawData[tabId].chapters, path.chapterIndex)
        success = true
    elseif path.type == 'article' then
        if lawData[tabId].chapters[path.chapterIndex] and 
           lawData[tabId].chapters[path.chapterIndex].articles[path.articleIndex] then
            table.remove(lawData[tabId].chapters[path.chapterIndex].articles, path.articleIndex)
            success = true
        end
    elseif path.type == 'point' then
        if lawData[tabId].chapters[path.chapterIndex] and 
           lawData[tabId].chapters[path.chapterIndex].articles[path.articleIndex] and
           lawData[tabId].chapters[path.chapterIndex].articles[path.articleIndex].points[path.pointIndex] then
            table.remove(lawData[tabId].chapters[path.chapterIndex].articles[path.articleIndex].points, path.pointIndex)
            success = true
        end
    end
    
    if success then
        SaveDataToFile(tabId)
        TriggerClientEvent('rsg-lawbook:client:updateData', -1, tabId, lawData[tabId])
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Удалено!', 'success')
    else
        TriggerClientEvent('rsg-lawbook:client:notify', source, 'Ошибка удаления!', 'error')
    end
end)

-- Команда перезагрузки (только консоль)
RegisterCommand('lawbook_reload', function(source, args, rawCommand)
    if source ~= 0 then 
        print('[RSG-Lawbook] Command only for console')
        return 
    end
    LoadAllData()
    print('[RSG-Lawbook] Data reloaded!')
end, true)

-- Команда выдачи предмета (для тестирования)
RegisterCommand('givelawbook', function(source, args, rawCommand)
    if source == 0 then 
        print('[RSG-Lawbook] Use this command in-game')
        return 
    end
    
    if RSGCore then
        local Player = RSGCore.Functions.GetPlayer(source)
        if Player then
            Player.Functions.AddItem('lawbook', 1)
            TriggerClientEvent('rsg-inventory:client:ItemBox', source, RSGCore.Shared.Items['lawbook'], 'add', 1)
            print('[RSG-Lawbook] Gave lawbook to player ' .. source)
        end
    end
end, false)