/**
 * Vault — 投票数据本地加密层
 *
 * 存储格式（localStorage 'gyp:counts:'）：
 *   原始 JSON → { d: 数据JSON, s: FNV-1a 校验和 } → 与盐异或 → 密文入库
 * 读取时逆向：解异或 → 验校验和 → 不匹配即视为被篡改/损坏，返回 null 丢弃。
 *
 * 能防什么：DevTools 明文查看与手改票数、注入伪造 JSON（校验不过直接作废）。
 * 不能防什么：有心人复用站内代码逻辑构造合法密文——本地数据由浏览器主人控制，
 * 跨用户的强制防篡改必须由服务端完成（接入云数据库后整体迁移）。
 */
window.Vault = (function () {
  'use strict';

  var SALT = 'GYP$2026#vote-vault';

  /** FNV-1a 32 位哈希，输出 7 位 base36 签名 */
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(36)).slice(-7);
  }

  /** 逐字符异或流加密（可逆） */
  function xor(text, key) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return out;
  }

  /** 加密：对象 → 密文字符串 */
  function seal(obj) {
    var json = JSON.stringify(obj);
    var env = JSON.stringify({ d: json, s: fnv1a(json + SALT) });
    return xor(env, SALT);
  }

  /** 解密：密文 → 对象；被篡改或损坏返回 null */
  function open(sealed) {
    try {
      var env = JSON.parse(xor(String(sealed), SALT));
      if (!env || typeof env.d !== 'string' || typeof env.s !== 'string') return null;
      if (fnv1a(env.d + SALT) !== env.s) return null;
      return JSON.parse(env.d);
    } catch (e) {
      return null;
    }
  }

  return { seal: seal, open: open };
})();
