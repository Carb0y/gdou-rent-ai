// 海大租房避坑AI - 主JavaScript文件

document.addEventListener('DOMContentLoaded', function() {
    console.log('海大租房避坑AI 页面加载完成');

    // ===== 首页动画 =====
    const container = document.querySelector('.container');
    if (container) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        setTimeout(() => {
            container.style.transition = 'opacity 0.6s, transform 0.6s';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 100);
    }

    // 功能卡片点击效果
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('click', function() {
            const featureName = this.querySelector('h3').textContent;
            alert(`【${featureName}】功能即将上线，敬请期待！`);
        });
    });

    // ===== QA 问答页面 =====
    const questionInput = document.getElementById('questionInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatContainer = document.getElementById('chatContainer');

    if (questionInput && sendBtn && chatContainer) {
        initQAPage(questionInput, sendBtn, chatContainer);
    }
});

// ===== QA 页面初始化 =====
function initQAPage(input, btn, container) {
    let isLoading = false;

    // 发送消息
    async function sendMessage() {
        const question = input.value.trim();
        if (!question || isLoading) return;

        // 显示用户消息
        addMessage(container, 'user', question);
        input.value = '';
        input.focus();

        // 显示加载状态
        const loadingMsg = addLoadingMessage(container);
        isLoading = true;
        btn.disabled = true;

        try {
            const response = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            const data = await response.json();

            // 移除加载状态
            loadingMsg.remove();

            if (data.fallback) {
                // 低相似度，直接回复
                addMessage(container, 'bot', data.answer, []);
            } else {
                // 正常回答，带来源
                addMessage(container, 'bot', data.answer, data.matched);
            }
        } catch (error) {
            loadingMsg.remove();
            addMessage(container, 'bot', '抱歉，网络出了点问题，请稍后再试 😢', []);
        } finally {
            isLoading = false;
            btn.disabled = false;
        }
    }

    // 发送按钮点击
    btn.addEventListener('click', sendMessage);

    // 回车发送
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 提示按钮点击
    const hintBtns = document.querySelectorAll('.hint-btn');
    hintBtns.forEach(hintBtn => {
        hintBtn.addEventListener('click', function() {
            const question = this.dataset.question;
            input.value = question;
            sendMessage();
        });
    });
}

// 添加消息到对话区
function addMessage(container, role, content, matchedSources) {
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';
    const avatarBg = role === 'user' ? 'user-avatar' : 'bot-avatar';

    let sourceHTML = '';
    if (matchedSources && matchedSources.length > 0) {
        sourceHTML = '<div class="match-source">';
        sourceHTML += '<div class="source-label">📚 参考知识来源：</div>';
        matchedSources.forEach(s => {
            sourceHTML += `<div class="source-item">
                <span class="source-badge">${Math.round(s.similarity * 100)}%</span>
                ${escapeHTML(s.question)}
            </div>`;
        });
        sourceHTML += '</div>';
    }

    // 将换行转为 <br>，简单 Markdown 处理
    let formattedContent = escapeHTML(content)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-bubble">${formattedContent}${sourceHTML}</div>
    `;

    container.appendChild(div);
    scrollToBottom(container);

    return div;
}

// 添加加载动画
function addLoadingMessage(container) {
    const div = document.createElement('div');
    div.className = 'chat-message bot loading';
    div.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(div);
    scrollToBottom(container);
    return div;
}

// 滚动到底部
function scrollToBottom(container) {
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// HTML 转义
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== 通用 API 函数 =====
async function fetchApartments() {
    try {
        const response = await fetch('/api/apartments');
        const data = await response.json();
        console.log('公寓数据:', data);
        return data;
    } catch (error) {
        console.error('获取公寓数据失败:', error);
    }
}

async function analyzeApartment(apartmentData) {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apartmentData)
        });
        const data = await response.json();
        console.log('分析结果:', data);
        return data;
    } catch (error) {
        console.error('分析失败:', error);
    }
}
