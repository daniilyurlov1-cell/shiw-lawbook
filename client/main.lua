local RSGCore = nil
local isBookOpen = false
local canEdit = false
local currentData = {}

-- Ждём загрузку ресурса
Citizen.CreateThread(function()
    Citizen.Wait(1000)
    
    if GetResourceState('rsg-core') == 'started' then
        RSGCore = exports['rsg-core']:GetCoreObject()
        if Config.Debug then
            print('[RSG-Lawbook] RSG Core loaded!')
        end
    else
        if Config.Debug then
            print('[RSG-Lawbook] RSG Core NOT found, using standalone mode')
        end
    end
    
    print('[RSG-Lawbook] Client started!')
    print('[RSG-Lawbook] Use /lawbook or lawbook item to open')
end)

-- Открытие через предмет
RegisterNetEvent('rsg-lawbook:client:openFromItem', function()
    print('[RSG-Lawbook] Opening from item...')
    OpenLawbook()
end)

-- Регистрация команды (опционально, можно убрать если только через предмет)
if Config.CommandEnabled then
    RegisterCommand(Config.Command, function()
        print('[RSG-Lawbook] Command triggered: ' .. Config.Command)
        OpenLawbook()
    end, false)
    
    for _, alias in ipairs(Config.CommandAliases) do
        RegisterCommand(alias, function()
            print('[RSG-Lawbook] Alias triggered: ' .. alias)
            OpenLawbook()
        end, false)
    end
end

-- Клавиша для открытия (опционально)
if Config.OpenKey and Config.OpenKey ~= '' then
    Citizen.CreateThread(function()
        while true do
            Citizen.Wait(0)
            
            -- F6 = 0xE8342FF2 для RedM
            if IsControlJustReleased(0, 0xE8342FF2) then
                if not isBookOpen then
                    print('[RSG-Lawbook] F6 pressed')
                    OpenLawbook()
                end
            end
        end
    end)
end

-- ESC для закрытия
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if isBookOpen and IsControlJustReleased(0, 0x156F7119) then
            CloseLawbook()
        end
    end
end)

-- Открытие книги
function OpenLawbook()
    if isBookOpen then 
        print('[RSG-Lawbook] Book already open')
        return 
    end
    
    print('[RSG-Lawbook] Opening book...')
    
    -- Запрашиваем данные с сервера
    TriggerServerEvent('rsg-lawbook:server:requestData')
end

-- Получение данных от сервера
RegisterNetEvent('rsg-lawbook:client:receiveData', function(data, canEditResult)
    print('[RSG-Lawbook] Data received from server')
    
    currentData = data or {}
    canEdit = canEditResult or false
    
    isBookOpen = true
    
    -- Запуск анимации чтения
    if Config.ReadingAnimation.enabled then
        StartReadingAnimation()
    end
    
    -- Открытие NUI
    SetNuiFocus(true, true)
    
    SendNUIMessage({
        action = 'open',
        data = currentData,
        canEdit = canEdit,
        tabs = Config.Tabs,
        titles = Config.UITitles
    })
    
    print('[RSG-Lawbook] NUI opened')
end)

-- Закрытие книги
function CloseLawbook()
    if not isBookOpen then return end
    
    print('[RSG-Lawbook] Closing book...')
    
    isBookOpen = false
    SetNuiFocus(false, false)
    
    -- Остановка анимации
    if Config.ReadingAnimation.enabled then
        StopReadingAnimation()
    end
    
    SendNUIMessage({
        action = 'close'
    })
end

-- Анимация чтения
function StartReadingAnimation()
    local ped = PlayerPedId()
    local dict = Config.ReadingAnimation.dict
    local anim = Config.ReadingAnimation.anim
    
    if not DoesAnimDictExist(dict) then
        print('[RSG-Lawbook] Anim dict not found: ' .. dict)
        return
    end
    
    RequestAnimDict(dict)
    local timeout = 0
    while not HasAnimDictLoaded(dict) and timeout < 50 do
        Citizen.Wait(100)
        timeout = timeout + 1
    end
    
    if HasAnimDictLoaded(dict) then
        TaskPlayAnim(ped, dict, anim, 8.0, -8.0, -1, 49, 0, false, false, false)
    end
end

function StopReadingAnimation()
    local ped = PlayerPedId()
    ClearPedTasks(ped)
end

-- NUI Callbacks
RegisterNUICallback('close', function(data, cb)
    print('[RSG-Lawbook] NUI close callback received')
    CloseLawbook()
    cb({ok = true})
end)

RegisterNUICallback('saveData', function(data, cb)
    if not canEdit then
        cb({success = false, message = 'Нет прав на редактирование'})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:saveData', data.tabId, data.content)
    cb({success = true})
end)

RegisterNUICallback('addChapter', function(data, cb)
    print('[RSG-Lawbook] Adding chapter...')
    if not canEdit then
        cb({success = false})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:addChapter', data.tabId, data.chapter)
    cb({success = true})
end)

RegisterNUICallback('addArticle', function(data, cb)
    print('[RSG-Lawbook] Adding article...')
    if not canEdit then
        cb({success = false})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:addArticle', data.tabId, data.chapterIndex, data.article)
    cb({success = true})
end)

RegisterNUICallback('addPoint', function(data, cb)
    print('[RSG-Lawbook] Adding point...')
    if not canEdit then
        cb({success = false})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:addPoint', data.tabId, data.chapterIndex, data.articleIndex, data.point)
    cb({success = true})
end)

RegisterNUICallback('deleteItem', function(data, cb)
    if not canEdit then
        cb({success = false})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:deleteItem', data.tabId, data.path)
    cb({success = true})
end)

RegisterNUICallback('editItem', function(data, cb)
    if not canEdit then
        cb({success = false})
        return
    end
    
    TriggerServerEvent('rsg-lawbook:server:editItem', data.tabId, data.path, data.newContent)
    cb({success = true})
end)

-- Обновление данных от сервера
RegisterNetEvent('rsg-lawbook:client:updateData', function(tabId, newData)
    currentData[tabId] = newData
    SendNUIMessage({
        action = 'updateData',
        tabId = tabId,
        data = newData
    })
end)

-- Уведомления
RegisterNetEvent('rsg-lawbook:client:notify', function(message, type)
    print('[RSG-Lawbook] Notify: ' .. message)
    
    if RSGCore and RSGCore.Functions and RSGCore.Functions.Notify then
        RSGCore.Functions.Notify(message, type)
    else
        TriggerEvent('chat:addMessage', {
            args = {'[Законы]', message}
        })
    end
end)

-- Тестовая команда
RegisterCommand('lawbooktest', function()
    print('[RSG-Lawbook] === TEST ===')
    print('[RSG-Lawbook] isBookOpen: ' .. tostring(isBookOpen))
    print('[RSG-Lawbook] RSGCore loaded: ' .. tostring(RSGCore ~= nil))
    
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        data = {
            laws = {
                title = "ТЕСТ",
                chapters = {
                    {
                        title = "Тестовая глава",
                        articles = {
                            {
                                title = "Тестовая статья",
                                content = "Это тестовый контент",
                                points = {}
                            }
                        }
                    }
                }
            }
        },
        canEdit = true,
        tabs = Config.Tabs,
        titles = Config.UITitles
    })
    isBookOpen = true
end, false)