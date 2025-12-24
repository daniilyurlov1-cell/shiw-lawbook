let bookData = {};
let currentTab = 'laws';
let currentPage = 0;
let canEdit = false;
let isEditMode = false;
let tabs = [];
let titles = {};
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let resourceName = 'shiw-lawbook'; // Имя вашего ресурса

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Получаем имя ресурса один раз при загрузке
    if (typeof GetParentResourceName === 'function') {
        resourceName = GetParentResourceName();
    }
    
    setupEventListeners();
    setupDragAndDrop();
    console.log('[Lawbook] NUI Loaded, resource: ' + resourceName);
});

// Слушатель сообщений от клиента
window.addEventListener('message', function(event) {
    const data = event.data;
    
    switch(data.action) {
        case 'open':
            console.log('[Lawbook] Opening book');
            openBook(data);
            break;
        case 'close':
            console.log('[Lawbook] Closing book');
            closeBook();
            break;
        case 'updateData':
            updateTabData(data.tabId, data.data);
            break;
    }
});

// Функция для отправки данных в Lua
function sendToLua(name, data) {
    console.log('[Lawbook] Sending to Lua: ' + name);
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://' + resourceName + '/' + name, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            console.log('[Lawbook] Response for ' + name + ': ' + xhr.status);
        }
    };
    xhr.send(JSON.stringify(data || {}));
}

function openBook(data) {
    bookData = data.data || {};
    canEdit = data.canEdit || false;
    tabs = data.tabs || [];
    titles = data.titles || {};
    
    document.getElementById('lawbook-container').classList.remove('hidden');
    
    generateBookmarks();
    
    if (canEdit) {
        document.getElementById('editModeBtn').classList.remove('hidden');
    } else {
        document.getElementById('editModeBtn').classList.add('hidden');
    }
    
    if (tabs.length > 0) {
        switchTab(tabs[0].id);
    }
}

function closeBook() {
    document.getElementById('lawbook-container').classList.add('hidden');
    isEditMode = false;
    document.getElementById('editPanel').classList.add('hidden');
    document.body.classList.remove('editing-mode');
}

function generateBookmarks() {
    var bookmarksContainer = document.getElementById('bookmarks');
    bookmarksContainer.innerHTML = '';
    
    for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        var bookmark = document.createElement('div');
        bookmark.className = 'bookmark';
        bookmark.setAttribute('data-tab-id', tab.id);
        bookmark.innerHTML = (tab.icon || '📄') + '<br>' + tab.title;
        
        (function(tabId) {
            bookmark.onclick = function() {
                switchTab(tabId);
            };
        })(tab.id);
        
        bookmarksContainer.appendChild(bookmark);
    }
}

function switchTab(tabId) {
    currentTab = tabId;
    currentPage = 0;
    
    var bookmarks = document.querySelectorAll('.bookmark');
    for (var i = 0; i < bookmarks.length; i++) {
        var b = bookmarks[i];
        if (b.getAttribute('data-tab-id') === tabId) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    }
    
    renderContent();
}

function renderContent() {
    var data = bookData[currentTab];
    if (!data) {
        console.log('[Lawbook] No data for tab: ' + currentTab);
        return;
    }
    
    renderTableOfContents();
    renderMainContent();
    updatePageNumbers();
}

function renderTableOfContents() {
    var leftPage = document.getElementById('left-page-content');
    var data = bookData[currentTab];
    
    var html = '<h1 class="book-title">' + (titles.bookTitle || 'СВОД ЗАКОНОВ') + '</h1>';
    html += '<h2 style="text-align:center; color:#8B4513; margin-bottom:20px;">' + (data.title || 'Оглавление') + '</h2>';
    
    if (data.chapters && data.chapters.length > 0) {
        for (var chIndex = 0; chIndex < data.chapters.length; chIndex++) {
            var chapter = data.chapters[chIndex];
            html += '<div class="toc-item toc-chapter" onclick="goToChapter(' + chIndex + ')">';
            html += (chIndex + 1) + '. ' + chapter.title;
            html += '</div>';
            
            if (chapter.articles) {
                for (var aIndex = 0; aIndex < chapter.articles.length; aIndex++) {
                    var article = chapter.articles[aIndex];
                    html += '<div class="toc-item toc-article" onclick="goToArticle(' + chIndex + ', ' + aIndex + ')">';
                    html += (chIndex + 1) + '.' + (aIndex + 1) + ' ' + article.title;
                    html += '</div>';
                }
            }
        }
    } else {
        html += '<p class="no-results">Содержимое отсутствует</p>';
    }
    
    leftPage.innerHTML = html;
}

function renderMainContent() {
    var rightPage = document.getElementById('right-page-content');
    var data = bookData[currentTab];
    
    var html = '';
    
    if (data.chapters && data.chapters.length > 0) {
        for (var chIndex = 0; chIndex < data.chapters.length; chIndex++) {
            var chapter = data.chapters[chIndex];
            
            html += '<div class="chapter" id="chapter-' + chIndex + '">';
            html += '<h2 class="chapter-title">';
            html += 'Глава ' + (chIndex + 1) + '. ' + chapter.title;
            if (isEditMode) {
                html += getEditButtons('chapter', chIndex, 0, 0);
            }
            html += '</h2>';
            
            if (chapter.articles) {
                for (var aIndex = 0; aIndex < chapter.articles.length; aIndex++) {
                    var article = chapter.articles[aIndex];
                    
                    html += '<div class="article" id="article-' + chIndex + '-' + aIndex + '">';
                    html += '<h3 class="article-title">';
                    html += 'Статья ' + (chIndex + 1) + '.' + (aIndex + 1) + '. ' + article.title;
                    if (isEditMode) {
                        html += getEditButtons('article', chIndex, aIndex, 0);
                    }
                    html += '</h3>';
                    
                    if (article.content) {
                        html += '<p class="article-content">' + article.content + '</p>';
                    }
                    
                    if (article.points) {
                        for (var pIndex = 0; pIndex < article.points.length; pIndex++) {
                            var point = article.points[pIndex];
                            html += '<div class="point">';
                            html += point.text;
                            if (point.penalty) {
                                html += '<span class="penalty"> (' + point.penalty + ')</span>';
                            }
                            if (isEditMode) {
                                html += getEditButtons('point', chIndex, aIndex, pIndex);
                            }
                            html += '</div>';
                        }
                    }
                    
                    html += '</div>';
                }
            }
            
            html += '</div>';
        }
    } else {
        html += '<p class="no-results">Выберите раздел для просмотра</p>';
    }
    
    rightPage.innerHTML = html;
}

function getEditButtons(type, chIndex, aIndex, pIndex) {
    var html = '';
    html += '<button class="edit-item-btn" onclick="editItem(\'' + type + '\', ' + chIndex + ', ' + aIndex + ', ' + pIndex + '); event.stopPropagation();">✏️</button>';
    html += '<button class="edit-item-btn delete-btn" onclick="deleteItem(\'' + type + '\', ' + chIndex + ', ' + aIndex + ', ' + pIndex + '); event.stopPropagation();">🗑️</button>';
    return html;
}

function updatePageNumbers() {
    document.getElementById('left-page-number').textContent = currentPage * 2 + 1;
    document.getElementById('right-page-number').textContent = currentPage * 2 + 2;
}

function goToChapter(chIndex) {
    var element = document.getElementById('chapter-' + chIndex);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function goToArticle(chIndex, aIndex) {
    var element = document.getElementById('article-' + chIndex + '-' + aIndex);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Event Listeners
function setupEventListeners() {
    // КНОПКА ЗАКРЫТИЯ
    document.getElementById('closeBtn').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Lawbook] Close button clicked');
        sendToLua('close', {});
    };
    
    // Поиск
    document.getElementById('searchBtn').onclick = performSearch;
    document.getElementById('searchInput').onkeypress = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    };
    
    // Режим редактирования
    document.getElementById('editModeBtn').onclick = toggleEditMode;
    document.getElementById('exitEditBtn').onclick = toggleEditMode;
    
    // Добавление элементов
    document.getElementById('addChapterBtn').onclick = function() {
        showModal('chapter');
    };
    document.getElementById('addArticleBtn').onclick = function() {
        showModal('article');
    };
    document.getElementById('addPointBtn').onclick = function() {
        showModal('point');
    };
    
    // Модальное окно
    document.getElementById('modalCancel').onclick = hideModal;
    document.getElementById('modalForm').onsubmit = handleModalSubmit;
    
    // Закрытие поиска
    document.getElementById('closeSearchResults').onclick = function() {
        document.getElementById('searchResults').classList.add('hidden');
    };
    
    // Навигация страниц
    document.getElementById('prevPage').onclick = function() {
        changePage(-1);
    };
    document.getElementById('nextPage').onclick = function() {
        changePage(1);
    };
    
    // ESC для закрытия
    document.onkeydown = function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            
            var modal = document.getElementById('modal');
            var searchResults = document.getElementById('searchResults');
            
            if (!modal.classList.contains('hidden')) {
                hideModal();
            } else if (!searchResults.classList.contains('hidden')) {
                searchResults.classList.add('hidden');
            } else {
                console.log('[Lawbook] ESC pressed - closing');
                sendToLua('close', {});
            }
        }
    };
    
    console.log('[Lawbook] Event listeners ready');
}

// Drag and Drop
function setupDragAndDrop() {
    var book = document.getElementById('book');
    
    book.onmousedown = function(e) {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) {
            return;
        }
        
        isDragging = true;
        var rect = book.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        book.style.cursor = 'grabbing';
    };
    
    document.onmousemove = function(e) {
        if (!isDragging) return;
        
        var book = document.getElementById('book');
        book.style.position = 'fixed';
        book.style.left = (e.clientX - dragOffset.x) + 'px';
        book.style.top = (e.clientY - dragOffset.y) + 'px';
        book.style.transform = 'none';
    };
    
    document.onmouseup = function() {
        isDragging = false;
        var book = document.getElementById('book');
        if (book) book.style.cursor = 'grab';
    };
}

// Поиск
function performSearch() {
    var query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!query) return;
    
    var results = [];
    var data = bookData[currentTab];
    
    if (data && data.chapters) {
        for (var chIndex = 0; chIndex < data.chapters.length; chIndex++) {
            var chapter = data.chapters[chIndex];
            
            if (chapter.title.toLowerCase().indexOf(query) !== -1) {
                results.push({
                    path: 'Глава ' + (chIndex + 1),
                    text: chapter.title,
                    chapterIndex: chIndex,
                    articleIndex: 0
                });
            }
            
            if (chapter.articles) {
                for (var aIndex = 0; aIndex < chapter.articles.length; aIndex++) {
                    var article = chapter.articles[aIndex];
                    
                    if (article.title.toLowerCase().indexOf(query) !== -1 || 
                        (article.content && article.content.toLowerCase().indexOf(query) !== -1)) {
                        results.push({
                            path: 'Глава ' + (chIndex + 1) + ' → Статья ' + (aIndex + 1),
                            text: article.title,
                            chapterIndex: chIndex,
                            articleIndex: aIndex
                        });
                    }
                    
                    if (article.points) {
                        for (var pIndex = 0; pIndex < article.points.length; pIndex++) {
                            var point = article.points[pIndex];
                            if (point.text.toLowerCase().indexOf(query) !== -1) {
                                results.push({
                                    path: 'Глава ' + (chIndex + 1) + ' → Статья ' + (aIndex + 1) + ' → Пункт ' + (pIndex + 1),
                                    text: point.text,
                                    chapterIndex: chIndex,
                                    articleIndex: aIndex
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    displaySearchResults(results, query);
}

function displaySearchResults(results, query) {
    var container = document.getElementById('searchResults');
    var list = document.getElementById('searchResultsList');
    
    if (results.length === 0) {
        list.innerHTML = '<p class="no-results">' + (titles.noResults || 'Ничего не найдено') + '</p>';
    } else {
        var html = '';
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            var regex = new RegExp('(' + query + ')', 'gi');
            var highlightedText = result.text.replace(regex, '<mark>$1</mark>');
            
            html += '<div class="search-result-item" onclick="goToArticle(' + result.chapterIndex + ', ' + result.articleIndex + '); document.getElementById(\'searchResults\').classList.add(\'hidden\');">';
            html += '<div class="search-result-path">' + result.path + '</div>';
            html += '<div class="search-result-text">' + highlightedText + '</div>';
            html += '</div>';
        }
        list.innerHTML = html;
    }
    
    container.classList.remove('hidden');
}

// Режим редактирования
function toggleEditMode() {
    isEditMode = !isEditMode;
    
    var editPanel = document.getElementById('editPanel');
    if (isEditMode) {
        editPanel.classList.remove('hidden');
        document.body.classList.add('editing-mode');
    } else {
        editPanel.classList.add('hidden');
        document.body.classList.remove('editing-mode');
    }
    
    renderContent();
}

var currentModalType = '';
var currentEditPath = null;

function showModal(type, editData) {
    currentModalType = type;
    currentEditPath = editData || null;
    
    var modal = document.getElementById('modal');
    var title = document.getElementById('modalTitle');
    var fields = document.getElementById('modalFields');
    
    var html = '';
    var chapters = (bookData[currentTab] && bookData[currentTab].chapters) ? bookData[currentTab].chapters : [];
    
    if (type === 'chapter') {
        title.textContent = editData ? 'Редактировать главу' : (titles.addChapter || 'Добавить главу');
        html = '<div class="modal-field">';
        html += '<label>Название главы:</label>';
        html += '<input type="text" id="chapterTitle" value="' + (editData ? editData.title : '') + '" required>';
        html += '</div>';
    } else if (type === 'article') {
        title.textContent = editData ? 'Редактировать статью' : (titles.addArticle || 'Добавить статью');
        html = '<div class="modal-field">';
        html += '<label>Глава:</label>';
        html += '<select id="chapterSelect" required>';
        if (chapters.length > 0) {
            for (var i = 0; i < chapters.length; i++) {
                html += '<option value="' + i + '">' + (i + 1) + '. ' + chapters[i].title + '</option>';
            }
        } else {
            html += '<option value="-1">Сначала создайте главу</option>';
        }
        html += '</select>';
        html += '</div>';
        html += '<div class="modal-field">';
        html += '<label>Название статьи:</label>';
        html += '<input type="text" id="articleTitle" value="' + (editData ? editData.title : '') + '" required>';
        html += '</div>';
        html += '<div class="modal-field">';
        html += '<label>Содержание:</label>';
        html += '<textarea id="articleContent">' + (editData ? editData.content : '') + '</textarea>';
        html += '</div>';
    } else if (type === 'point') {
        title.textContent = editData ? 'Редактировать пункт' : (titles.addPoint || 'Добавить пункт');
        html = '<div class="modal-field">';
        html += '<label>Глава:</label>';
        html += '<select id="chapterSelect" onchange="updateArticleSelect()" required>';
        if (chapters.length > 0) {
            for (var i = 0; i < chapters.length; i++) {
                html += '<option value="' + i + '">' + (i + 1) + '. ' + chapters[i].title + '</option>';
            }
        } else {
            html += '<option value="-1">Сначала создайте главу</option>';
        }
        html += '</select>';
        html += '</div>';
        html += '<div class="modal-field">';
        html += '<label>Статья:</label>';
        html += '<select id="articleSelect" required></select>';
        html += '</div>';
        html += '<div class="modal-field">';
        html += '<label>Текст пункта:</label>';
        html += '<textarea id="pointText" required>' + (editData ? editData.text : '') + '</textarea>';
        html += '</div>';
        html += '<div class="modal-field">';
        html += '<label>Наказание:</label>';
        html += '<input type="text" id="pointPenalty" value="' + (editData ? editData.penalty : '') + '" placeholder="Например: штраф $50">';
        html += '</div>';
    }
    
    fields.innerHTML = html;
    modal.classList.remove('hidden');
    
    if (type === 'point') {
        setTimeout(updateArticleSelect, 50);
    }
}

function updateArticleSelect() {
    var chapterSelect = document.getElementById('chapterSelect');
    var articleSelect = document.getElementById('articleSelect');
    
    if (!chapterSelect || !articleSelect) return;
    
    var chapterIndex = parseInt(chapterSelect.value);
    var chapters = (bookData[currentTab] && bookData[currentTab].chapters) ? bookData[currentTab].chapters : [];
    var chapter = chapters[chapterIndex];
    
    var html = '';
    if (chapter && chapter.articles && chapter.articles.length > 0) {
        for (var i = 0; i < chapter.articles.length; i++) {
            html += '<option value="' + i + '">' + (i + 1) + '. ' + chapter.articles[i].title + '</option>';
        }
    } else {
        html = '<option value="-1">Сначала создайте статью</option>';
    }
    articleSelect.innerHTML = html;
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
    currentModalType = '';
    currentEditPath = null;
}

function handleModalSubmit(e) {
    e.preventDefault();
    
    var data = { tabId: currentTab };
    
    if (currentModalType === 'chapter') {
        data.chapter = {
            title: document.getElementById('chapterTitle').value
        };
        sendToLua('addChapter', data);
    } else if (currentModalType === 'article') {
        var chapterIdx = parseInt(document.getElementById('chapterSelect').value);
        if (chapterIdx < 0) {
            alert('Сначала создайте главу!');
            return;
        }
        data.chapterIndex = chapterIdx + 1;
        data.article = {
            title: document.getElementById('articleTitle').value,
            content: document.getElementById('articleContent').value
        };
        sendToLua('addArticle', data);
    } else if (currentModalType === 'point') {
        var chIdx = parseInt(document.getElementById('chapterSelect').value);
        var artIdx = parseInt(document.getElementById('articleSelect').value);
        if (chIdx < 0 || artIdx < 0) {
            alert('Сначала создайте главу и статью!');
            return;
        }
        data.chapterIndex = chIdx + 1;
        data.articleIndex = artIdx + 1;
        data.point = {
            text: document.getElementById('pointText').value,
            penalty: document.getElementById('pointPenalty').value
        };
        sendToLua('addPoint', data);
    }
    
    hideModal();
}

function editItem(type, chIndex, aIndex, pIndex) {
    var editData = null;
    var chapters = (bookData[currentTab] && bookData[currentTab].chapters) ? bookData[currentTab].chapters : [];
    
    if (type === 'chapter') {
        editData = chapters[chIndex];
    } else if (type === 'article') {
        editData = chapters[chIndex] && chapters[chIndex].articles ? chapters[chIndex].articles[aIndex] : null;
    } else if (type === 'point') {
        editData = chapters[chIndex] && chapters[chIndex].articles && chapters[chIndex].articles[aIndex] && chapters[chIndex].articles[aIndex].points ? 
                   chapters[chIndex].articles[aIndex].points[pIndex] : null;
    }
    
    currentEditPath = { 
        type: type, 
        chapterIndex: chIndex + 1, 
        articleIndex: aIndex + 1, 
        pointIndex: pIndex + 1 
    };
    showModal(type, editData);
}

function deleteItem(type, chIndex, aIndex, pIndex) {
    if (!confirm('Вы уверены, что хотите удалить этот элемент?')) return;
    
    sendToLua('deleteItem', {
        tabId: currentTab,
        path: {
            type: type,
            chapterIndex: chIndex + 1,
            articleIndex: aIndex + 1,
            pointIndex: pIndex + 1
        }
    });
}

function updateTabData(tabId, data) {
    bookData[tabId] = data;
    if (currentTab === tabId) {
        renderContent();
    }
}

function changePage(direction) {
    var rightPage = document.getElementById('right-page-content');
    rightPage.scrollBy({ top: direction * 400, behavior: 'smooth' });
}