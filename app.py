import json
import os
import difflib
import requests
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# ---- 加载知识库 ----
def load_knowledge():
    with open('data/knowledge.json', 'r', encoding='utf-8') as f:
        return json.load(f)['knowledge']


# ---- 模糊匹配 ----
def fuzzy_match(query, knowledge, top_n=3):
    """使用 difflib.SequenceMatcher 做模糊匹配，返回最相似的 top_n 个条目

    question 字段支持多个变体（用中文/英文问号分隔），取最高匹配分
    """
    import re
    scored = []
    for item in knowledge:
        # 拆分变体，分别计算相似度，取最大值
        variants = re.split(r'[？\?]', item['question'])
        variants = [v.strip() for v in variants if v.strip()]
        max_ratio = max(
            (difflib.SequenceMatcher(None, query, v).ratio() for v in variants),
            default=0.0
        )
        scored.append((max_ratio, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:top_n]


# ---- 调用 DeepSeek API ----
def call_deepseek(query, context_items):
    """调用 DeepSeek API，用知识库上下文回答用户问题"""
    api_key = os.environ.get('ZHIPU_API_KEY', 'sk-f6961e27e8554142bd459ff94f2e1b68')

    # 构建上下文
    context_text = ''
    for i, (ratio, item) in enumerate(context_items, 1):
        context_text += f'【参考知识{i}】（相似度：{ratio:.2f}）\n问：{item["question"]}\n答：{item["answer"]}\n\n'

    system_prompt = (
        '你是"海大租房避坑AI"，一个专门帮助大学生解决租房问题的智能助手。\n'
        '你的知识来源于真实的租房经验和本地知识库。\n\n'
        '回答规则：\n'
        '1. 基于下面提供的参考知识来回答用户问题\n'
        '2. 回答要实用、接地气，像学长学姐在分享经验\n'
        '3. 如果参考知识不够完整，可以适当补充通用租房常识\n'
        '4. 回答控制在300字以内，重点突出\n'
        '5. 结尾可以加一句温馨提示\n\n'
        f'参考知识：\n{context_text}'
    )

    payload = {
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': query}
        ],
        'temperature': 0.7,
        'max_tokens': 600
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            json=payload,
            headers=headers,
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        return data['choices'][0]['message']['content']
    except requests.exceptions.RequestException as e:
        return f'抱歉，AI服务暂时不可用，请稍后再试。（错误：{str(e)}）'


# ==================== 路由 ====================

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/qa')
def qa_page():
    return render_template('qa.html')


@app.route('/api/apartments', methods=['GET'])
def get_apartments():
    return jsonify({'message': '公寓数据接口即将上线', 'status': 'coming_soon'})


@app.route('/api/analyze', methods=['POST'])
def analyze_apartment():
    return jsonify({'message': '分析功能即将上线', 'status': 'coming_soon'})


@app.route('/api/qa', methods=['POST'])
def qa_api():
    data = request.get_json()
    query = data.get('question', '').strip()

    if not query:
        return jsonify({'error': '请输入问题'}), 400

    # 关键词拦截：身份类问题直接返回
    q_lower = query.lower()
    identity_keywords = ['你是谁', '你叫啥', '你姓啥', '你叫什么', '你的名字', '你哪位', '怎么称呼']
    if any(kw in q_lower for kw in identity_keywords):
        return jsonify({
            'answer': '我是何从丰',
            'matched': [],
            'fallback': False
        })

    # 加载知识库 & 模糊匹配
    knowledge = load_knowledge()
    matched = fuzzy_match(query, knowledge, top_n=3)

    # 相似度阈值判断
    best_ratio = matched[0][0] if matched else 0
    if best_ratio < 0.3:
        return jsonify({
            'answer': '抱歉，这个问题我还没学到，建议你实地看房时问问房东。',
            'matched': [],
            'fallback': True
        })

    # 调用 AI 生成回答
    answer = call_deepseek(query, matched)

    # 返回匹配到的知识条目信息（用于前端展示参考来源）
    matched_info = [
        {'question': item['question'], 'similarity': round(ratio, 2)}
        for ratio, item in matched
    ]

    return jsonify({
        'answer': answer,
        'matched': matched_info,
        'fallback': False
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
