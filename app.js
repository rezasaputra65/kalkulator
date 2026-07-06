(() => {
  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const chatEl = document.getElementById('chat');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const btnEqual = document.getElementById('btnEqual');
  const btnToChat = document.getElementById('btnToChat');

  let expression = '0';

  function sanitizeNumberString(s) {
    // allow digits, dot
    return s.replace(/[^0-9.]/g, '');
  }

  function updateDisplay() {
    exprEl.textContent = expression;
    const canEval = /[0-9]/.test(expression);
    if (canEval) {
      const val = safeCompute(expression);
      resultEl.textContent = val.ok ? formatNumber(val.value) : '—';
    } else {
      resultEl.textContent = '0';
    }
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '—';
    // If integer, show as integer. Otherwise limit decimals.
    if (Number.isInteger(n)) return String(n);
    return String(Math.round((n + Number.EPSILON) * 1e12) / 1e12);
  }

  // --- Safe expression evaluator (no eval) ---
  // Supports: + - * / ( ) and decimals, unary minus.
  function safeCompute(input) {
    try {
      const tokens = tokenize(input);
      const ast = parseExpression(tokens);
      const out = evalAst(ast);
      if (!tokens.consumedAll) {
        return { ok: false, error: 'Token ekstra' };
      }
      return { ok: true, value: out };
    } catch (e) {
      return { ok: false, error: e?.message || 'Gagal' };
    }
  }

  function tokenize(str) {
    const s = String(str).replace(/\s+/g, '');
    const tokens = [];
    let i = 0;

    const isDigit = (c) => c >= '0' && c <= '9';

    while (i < s.length) {
      const c = s[i];

      if (c === '(' || c === ')' || c === '+' || c === '-' || c === '*' || c === '/') {
        tokens.push({ type: 'op', value: c });
        i++;
        continue;
      }

      // number: digits and dots
      if (isDigit(c) || c === '.') {
        let j = i;
        let dotCount = 0;
        while (j < s.length) {
          const cj = s[j];
          if (isDigit(cj)) {
            j++;
            continue;
          }
          if (cj === '.') {
            dotCount++;
            if (dotCount > 1) break;
            j++;
            continue;
          }
          break;
        }
        const numStr = s.slice(i, j);
        if (numStr === '.' || numStr === '') throw new Error('Angka tidak valid');
        tokens.push({ type: 'num', value: parseFloat(numStr) });
        i = j;
        continue;
      }

      // unknown
      throw new Error('Karakter tidak didukung');
    }

    // Attach helpers
    tokens.consumedAll = false;
    return tokens;
  }

  // Recursive descent parser
  // Grammar:
  // expr   := term (('+'|'-') term)*
  // term   := factor (('*'|'/') factor)*
  // factor := ('-' factor) | primary
  // primary := num | '(' expr ')'

  function parseExpression(tokens) {
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseExpr() {
      let node = parseTerm();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseTerm();
        node = { type: 'bin', op, left: node, right };
      }
      return node;
    }

    function parseTerm() {
      let node = parseFactor();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        const right = parseFactor();
        node = { type: 'bin', op, left: node, right };
      }
      return node;
    }

    function parseFactor() {
      if (peek() && peek().type === 'op' && peek().value === '-') {
        consume();
        const inner = parseFactor();
        return { type: 'un', op: '-', value: inner };
      }
      return parsePrimary();
    }

    function parsePrimary() {
      const t = peek();
      if (!t) throw new Error('Ekspresi tidak lengkap');

      if (t.type === 'num') {
        consume();
        return { type: 'num', value: t.value };
      }

      if (t.type === 'op' && t.value === '(') {
        consume();
        const node = parseExpr();
        const close = peek();
        if (!close || close.type !== 'op' || close.value !== ')') {
          throw new Error('Kurung tidak seimbang');
        }
        consume();
        return node;
      }

      throw new Error('Token tidak valid');
    }

    const root = parseExpr();
    tokens.consumedAll = pos === tokens.length;
    return root;
  }

  function evalAst(node) {
    if (node.type === 'num') return node.value;
    if (node.type === 'un') {
      if (node.op === '-') return -evalAst(node.value);
    }
    if (node.type === 'bin') {
      const l = evalAst(node.left);
      const r = evalAst(node.right);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? NaN : l / r;
      }
    }
    throw new Error('AST tidak dikenal');
  }

  function appendToExpression(val) {
    if (expression === '0' && /[0-9]/.test(val)) {
      expression = val;
      updateDisplay();
      return;
    }

    // prevent multiple dots in a number segment (basic)
    if (val === '.') {
      const segments = expression.split(/[^0-9.]/);
      const last = segments[segments.length - 1] || '';
      if (last.includes('.')) return;
    }

    expression += val;
    updateDisplay();
  }

  function clearExpression() {
    expression = '0';
    updateDisplay();
  }

  function backspace() {
    if (expression.length <= 1) {
      expression = '0';
    } else {
      expression = expression.slice(0, -1);
      if (expression === '-' || expression === '' || expression === ' ') expression = '0';
    }
    updateDisplay();
  }

  function commitCompute() {
    const out = safeCompute(expression);
    if (!out.ok) {
      resultEl.textContent = 'Error';
      pushChat('AI', aiReply(`maaf, coba hitung lagi: ${expression}`));
      return;
    }
    const formatted = formatNumber(out.value);
    resultEl.textContent = formatted;
    expression = String(out.value);
    exprEl.textContent = expression;
  }

  function pushChat(who, text) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + (who === 'AI' ? 'ai' : 'user');
    msg.innerHTML = `<div class="bubble"><b>${who}:</b> ${escapeHtml(text)}</div>`;
    chatEl.appendChild(msg);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll('"', '"')
      .replaceAll("'", '&#039;');
  }

  // --- Offline AI (rules-based) ---
  function extractExpressionFromText(text) {
    // Try to find an arithmetic expression inside text.
    // Accept characters: digits, ., + - * / ( ) and spaces.
    const m = text.match(/([0-9\s+\-*/().]+)/);
    if (!m) return null;
    const candidate = m[1].replace(/\s+/g, '');
    if (!candidate) return null;
    // Basic sanity: at least one digit
    if (!/[0-9]/.test(candidate)) return null;
    return candidate;
  }

  function aiReply(userText) {
    const t = userText.trim();
    const lower = t.toLowerCase();

    // Quick intents
    if (/^(hi|halo|hai|hallo)\b/.test(lower)) {
      return 'Halo! Tulis ekspresi seperti: 12+7 atau pertanyaan: “hitung 10*(3+2)”.';
    }

    if (/(apa itu|jelaskan|definisi)\s+kalkulator/.test(lower)) {
      return 'Kalkulator adalah alat untuk melakukan operasi aritmetika seperti penjumlahan, pengurangan, perkalian, dan pembagian.';
    }

    if (/(tips|cara menggunakan)/.test(lower)) {
      return 'Gunakan tanda: + − untuk operasi, * untuk kali, / untuk bagi, serta ( ) untuk prioritas. Contoh: (2+3)*4.';
    }

    if (/(hitung|berapa|hasil|kuhitung|tuliskan hasil)/.test(lower)) {
      const exp = extractExpressionFromText(t);
      if (!exp) return 'Saya bisa bantu hitung. Coba tulis ekspresi seperti: 2+2 atau 10*(3+2).';
      const out = safeCompute(exp);
      if (!out.ok || !Number.isFinite(out.value)) {
        return `Maaf, ekspresi yang saya temukan tidak valid: ${exp}`;
      }
      return `Hasil ${exp} = ${formatNumber(out.value)}`;
    }

    // If message itself looks like expression
    if (/^[0-9+\-*/().\s]+$/.test(t)) {
      const exp = t.replace(/\s+/g, '');
      const out = safeCompute(exp);
      if (!out.ok || !Number.isFinite(out.value)) return `Ekspresi tidak valid: ${exp}`;
      return `Hasil ${exp} = ${formatNumber(out.value)}`;
    }

    // Fallback knowledge
    if (/(prioritas|urutan)/.test(lower)) {
      return 'Prioritas operasi: ( ) dulu, lalu kali/bagi (* /), kemudian tambah/kurang (+ −).';
    }

    return 'Saya AI offline. Coba: “hitung 12+7”, “berapa 10*(3+2)”, atau tanyakan urutan operasi.';
  }

  // UI events
  document.querySelectorAll('.key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const val = btn.dataset.value;

      if (action === 'clear') return clearExpression();
      if (action === 'back') return backspace();
      if (val != null) {
        appendToExpression(val);
      }
    });
  });

  btnEqual.addEventListener('click', (e) => {
    e.preventDefault();
    commitCompute();
  });

  btnToChat.addEventListener('click', (e) => {
    e.preventDefault();
    const payload = `hitung ${expression}`;
    pushChat('User', payload);
    const reply = aiReply(payload);
    pushChat('AI', reply);
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value;
    if (!text.trim()) return;

    pushChat('User', text);
    const reply = aiReply(text);
    pushChat('AI', reply);
    chatInput.value = '';
  });

  // Initialize
  updateDisplay();
  pushChat('AI', 'Halo! Saya Kalkulator AI offline. Ketik ekspresi atau: "hitung 12+7".');

  // Keyboard support
  window.addEventListener('keydown', (e) => {
    const k = e.key;

    if (k === 'Enter') {
      e.preventDefault();
      commitCompute();
      return;
    }
    if (k === 'Backspace') {
      e.preventDefault();
      backspace();
      return;
    }
    if (k === 'Escape') {
      e.preventDefault();
      clearExpression();
      return;
    }

    // digits and operators
    if (/^[0-9]$/.test(k)) {
      appendToExpression(k);
      return;
    }
    if (k === '.') {
      appendToExpression('.');
      return;
    }
    if (k === '+' || k === '-' || k === '*' || k === '/' || k === '(' || k === ')') {
      appendToExpression(k);
    }
  });
})();

