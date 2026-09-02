#!/usr/bin/env node
/* JAPANESE UP! 教材データ検証。実行: node scripts/validate-content.mjs（Node.js 18 以上、追加パッケージ不要） */
/* ---- 共通部分（各 repo の validate-content.mjs に同じものを埋め込んでいる） ---- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const errors = [];
function err(file, id, msg){ errors.push({ file, id, msg }); }

const utf8 = new TextDecoder('utf-8', { fatal: true });
function readJson(file){
  const full = path.join(DATA, file);
  if(!fs.existsSync(full)){ err(file, '', 'ファイルがありません'); return null; }
  let text;
  try{ text = utf8.decode(fs.readFileSync(full)); }
  catch(e){ err(file, '', 'UTF-8 として読めません: ' + e.message); return null; }
  if(text.charCodeAt(0) === 0xFEFF){ err(file, '', '先頭に BOM があります（BOM なしの UTF-8 にしてください）'); text = text.slice(1); }
  try{ return JSON.parse(text); }
  catch(e){ err(file, '', 'JSON として parse できません: ' + e.message); return null; }
}

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;   // 改行(\n)とCR以外の制御文字
const CR = /\r/;
function checkStr(file, id, key, v, opt = {}){
  if(typeof v !== 'string'){ err(file, id, `${key} は文字列である必要があります（今は ${typeof v}）`); return false; }
  if(!opt.allowEmpty && v.trim() === ''){ err(file, id, `${key} が空です`); return false; }
  if(CTRL.test(v)) err(file, id, `${key} に制御文字が含まれています`);
  if(CR.test(v)) err(file, id, `${key} に CR (\\r) が含まれています`);
  if(v !== v.trim()) err(file, id, `${key} の前後に空白があります`);
  return true;
}
function checkStrArray(file, id, key, v, opt = {}){
  if(!Array.isArray(v)){ err(file, id, `${key} は配列である必要があります`); return false; }
  if(opt.len != null && v.length !== opt.len) err(file, id, `${key} は ${opt.len} 件である必要があります（今は ${v.length}）`);
  if(opt.min != null && v.length < opt.min) err(file, id, `${key} は ${opt.min} 件以上必要です（今は ${v.length}）`);
  v.forEach((x, i) => checkStr(file, id, `${key}[${i}]`, x));
  if(!opt.allowDup && new Set(v).size !== v.length) err(file, id, `${key} に同じ値が重複しています`);
  return true;
}
function checkKeys(file, id, obj, required, optional){
  for(const k of required) if(!(k in obj)) err(file, id, `必須 property "${k}" がありません`);
  const allowed = new Set([...required, ...optional]);
  for(const k of Object.keys(obj)) if(!allowed.has(k)) err(file, id, `未知の property "${k}" があります（許可: ${[...allowed].join(', ')}）`);
}
function checkEnum(file, id, key, v, allowed){
  if(!allowed.includes(v)) err(file, id, `${key} "${v}" は許可されていません（許可: ${allowed.join(', ')}）`);
}
function checkInt(file, id, key, v, min, max){
  if(!Number.isInteger(v)){ err(file, id, `${key} は整数である必要があります（今は ${JSON.stringify(v)}）`); return false; }
  if(v < min || v > max){ err(file, id, `${key} = ${v} は範囲外です（${min}〜${max}）`); return false; }
  return true;
}
function checkIdFormat(file, id, key = 'id'){
  if(typeof id !== 'string' || id === ''){ err(file, String(id), `${key} が空です`); return false; }
  if(!/^[A-Za-z0-9_-]+$/.test(id)){ err(file, id, `${key} に使える文字は英数字・_・- だけです`); return false; }
  return true;
}
/** 4択問題（id, f, lv, q, ch[4], a, ex）の共通チェック */
function checkQuizItem(file, it, i, opt){
  const id = typeof it.id === 'string' ? it.id : `(items[${i}])`;
  if(!it || typeof it !== 'object' || Array.isArray(it)){ err(file, id, 'item はオブジェクトである必要があります'); return; }
  checkKeys(file, id, it, ['id', 'f', 'lv', 'q', 'ch', 'a', 'ex'], []);
  checkIdFormat(file, it.id);
  checkEnum(file, id, 'f', it.f, opt.fields);
  if(opt.expectField && it.f !== opt.expectField) err(file, id, `f "${it.f}" がこのファイルの分野 "${opt.expectField}" と一致しません`);
  if(opt.prefix && typeof it.id === 'string' && opt.prefix[it.f] && !it.id.startsWith(opt.prefix[it.f] + '_'))
    err(file, id, `id は分野 "${it.f}" の接頭辞 "${opt.prefix[it.f]}_" で始める決まりです`);
  checkEnum(file, id, 'lv', it.lv, opt.levels);
  checkStr(file, id, 'q', it.q);
  checkStrArray(file, id, 'ch', it.ch, { len: 4 });
  if(checkInt(file, id, 'a', it.a, 0, 3) && Array.isArray(it.ch) && it.a >= it.ch.length) err(file, id, `a = ${it.a} が選択肢の数を超えています`);
  checkStr(file, id, 'ex', it.ex);
}
function checkDupIds(file, ids, seen, label = 'id'){
  for(const id of ids){
    if(seen.has(id)) err(file, id, `${label} "${id}" が重複しています（先に ${seen.get(id)} にあります）`);
    else seen.set(id, file);
  }
}
/** manifest から参照されていない data/*.json、参照先の欠けを確認 */
function checkDataDir(referenced){
  const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json'));
  for(const f of files) if(!referenced.has(f)) err(f, '', 'data/index.json から参照されていない JSON です（不要なら削除、必要なら manifest に登録）');
  for(const f of referenced) if(!files.includes(f)) err(f, '', 'manifest が参照していますが data/ に存在しません');
  for(const f of fs.readdirSync(DATA)) if(f === '.DS_Store' || f.startsWith('._')) err(f, '', '不要なファイルです（削除してください）');
}
function finish(summary){
  for(const s of summary) console.log('  ' + s);
  if(errors.length){
    console.error(`\n✗ ${errors.length} 件の問題があります:`);
    for(const e of errors) console.error(`  [${e.file}]${e.id ? ' ' + e.id : ''}: ${e.msg}`);
    process.exit(1);
  }
  console.log('\n✓ OK: 問題はありません');
}

/* ---- JAPANESE UP! 固有 ---- */
const FIELDS = ['kanji', 'goi', 'bunpo', 'koten'];              // 本体4択の分野
const PREFIX = { kanji: 'k', goi: 'g', bunpo: 'b', koten: 't' }; // 4択 id の接頭辞
const LEVELS = ['easy', 'std', 'hard'];
// 語彙セットごとの item schema。i と w は共通で必須。
//   r: 読み（「読みを書く」に出る） / m: 意味（「意味カード」に出る） / alt: 別解の読み / h: 語義・用例のヒント
const VOCAB_RULES = {
  kanji:    { prefix: 'k', required: ['r'],      optional: ['alt', 'h'] },
  yoji:     { prefix: 'y', required: ['r', 'm'], optional: ['alt', 'h'] },
  kotowaza: { prefix: 'p', required: ['m'],      optional: [] },
  kobun:    { prefix: 'g', required: ['m'],      optional: [] }
};

const idx = readJson('index.json');
if(!idx){ finish([]); }
checkKeys('index.json', '', idx, ['version', 'sets', 'quizTotal', 'vocabTotal', 'total'], ['levels']);
if(idx.version !== 2) err('index.json', '', `version は 2 である必要があります（今は ${idx.version}）`);
if(idx.levels && JSON.stringify(idx.levels) !== JSON.stringify(LEVELS)) err('index.json', '', `levels は ${JSON.stringify(LEVELS)} である必要があります`);
if(!Array.isArray(idx.sets)) { err('index.json', '', 'sets は配列である必要があります'); finish([]); }

const referenced = new Set(['index.json']);
const seenQuizIds = new Map(), seenVocabIds = new Map(), seenSet = new Map();
let quizSum = 0, vocabSum = 0;
const summary = [];
for(const st of idx.sets){
  const sid = st && st.id;
  checkEnum('index.json', sid, 'kind', st.kind, ['quiz', 'vocab']);
  if(seenSet.has(st.id)) err('index.json', sid, 'sets の id が重複しています'); seenSet.set(st.id, true);
  checkStr('index.json', sid, 'name', st.name);
  if(typeof st.file !== 'string' || !/^[a-z0-9_-]+\.json$/.test(st.file)){ err('index.json', sid, 'file 名が不正です'); continue; }
  referenced.add(st.file);
  const doc = readJson(st.file);
  if(!doc) continue;
  if(st.kind === 'quiz'){
    checkKeys('index.json', sid, st, ['id', 'field', 'name', 'file', 'kind', 'count'], []);
    checkEnum('index.json', sid, 'field', st.field, FIELDS);
    if(st.id !== 'quiz-' + st.field) err('index.json', sid, `4択の set id は "quiz-${st.field}" にしてください`);
    if(st.file !== 'quiz-' + st.field + '.json') err('index.json', sid, `4択の file は "quiz-${st.field}.json" にしてください`);
    checkKeys(st.file, '', doc, ['version', 'items'], []);
    if(doc.version !== 1) err(st.file, '', `version は 1 である必要があります（今は ${doc.version}）`);
    if(!Array.isArray(doc.items)){ err(st.file, '', 'items は配列である必要があります'); continue; }
    doc.items.forEach((it, i) => checkQuizItem(st.file, it, i, { fields: FIELDS, levels: LEVELS, expectField: st.field, prefix: PREFIX }));
    checkDupIds(st.file, doc.items.map(x => x.id), seenQuizIds);
    quizSum += doc.items.length;
    const byLv = {}; doc.items.forEach(x => { byLv[x.lv] = (byLv[x.lv] || 0) + 1; });
    summary.push(`${st.file}: ${doc.items.length} 問 (${LEVELS.map(l => `${l} ${byLv[l] || 0}`).join(' / ')})`);
  }else{
    checkKeys('index.json', sid, st, ['id', 'name', 'file', 'kind', 'count'], []);
    checkKeys(st.file, '', doc, ['id', 'name', 'items'], []);
    if(doc.id !== st.id) err(st.file, '', `ファイル内の id "${doc.id}" が manifest の id "${st.id}" と一致しません`);
    if(doc.name !== st.name) err(st.file, '', `ファイル内の name "${doc.name}" が manifest の name "${st.name}" と一致しません`);
    if(!Array.isArray(doc.items)){ err(st.file, '', 'items は配列である必要があります'); continue; }
    const rule = VOCAB_RULES[st.id];
    if(!rule) err('index.json', sid, `語彙セット "${st.id}" の schema が validator に定義されていません（VOCAB_RULES に追加してください）`);
    const seenW = new Map();
    doc.items.forEach((it, i) => {
      const id = typeof it.i === 'string' ? it.i : `(items[${i}])`;
      const req = ['i', 'w', ...(rule ? rule.required : [])];
      const opt = rule ? rule.optional : ['r', 'm', 'alt', 'h'];
      checkKeys(st.file, id, it, req, opt);
      checkIdFormat(st.file, it.i, 'i');
      if(rule && typeof it.i === 'string' && !new RegExp('^' + rule.prefix + '\\d+$').test(it.i)) err(st.file, id, `i は "${rule.prefix}" + 数字 の形にしてください`);
      checkStr(st.file, id, 'w', it.w);
      if('r' in it) checkStr(st.file, id, 'r', it.r);
      if('m' in it) checkStr(st.file, id, 'm', it.m);
      if('h' in it) checkStr(st.file, id, 'h', it.h);
      if(!('r' in it) && !('m' in it)) err(st.file, id, 'r（読み）か m（意味）のどちらかは必要です');
      if('alt' in it){
        if(!('r' in it)) err(st.file, id, 'alt は r（読み）があるときだけ使えます');
        checkStrArray(st.file, id, 'alt', it.alt, { min: 1 });
        if(Array.isArray(it.alt) && it.alt.includes(it.r)) err(st.file, id, 'alt に r と同じ読みが入っています');
      }
      if(seenW.has(it.w)) err(st.file, id, `同じ語 "${it.w}" が ${seenW.get(it.w)} と重複しています`); else seenW.set(it.w, id);
    });
    checkDupIds(st.file, doc.items.map(x => x.i), seenVocabIds, 'i');
    vocabSum += doc.items.length;
    summary.push(`${st.file}: ${doc.items.length} 語 (読み ${doc.items.filter(x => x.r).length} / 意味 ${doc.items.filter(x => x.m).length})`);
  }
  if(st.count !== doc.items.length) err('index.json', sid, `count = ${st.count} が実件数 ${doc.items.length} と一致しません`);
}
for(const f of FIELDS) if(!seenSet.has('quiz-' + f)) err('index.json', 'quiz-' + f, `分野 "${f}" の4択 set がありません`);
if(idx.quizTotal !== quizSum) err('index.json', '', `quizTotal = ${idx.quizTotal} が4択の合計 ${quizSum} と一致しません`);
if(idx.vocabTotal !== vocabSum) err('index.json', '', `vocabTotal = ${idx.vocabTotal} が語彙の合計 ${vocabSum} と一致しません`);
if(idx.total !== quizSum + vocabSum) err('index.json', '', `total = ${idx.total} が quizTotal + vocabTotal = ${quizSum + vocabSum} と一致しません`);
summary.push(`4択 合計 ${quizSum} 問（quizTotal = ${idx.quizTotal}）、語彙 合計 ${vocabSum} 語（vocabTotal = ${idx.vocabTotal}）`);
checkDataDir(referenced);
finish(summary);
