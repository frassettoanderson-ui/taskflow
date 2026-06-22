#!/usr/bin/env node
/* Remove a "tela preta" (console) do .exe gerado pelo pkg.
 * Muda o Subsystem no cabecalho PE de 3 (CONSOLE) para 2 (WINDOWS/GUI),
 * assim o Windows nao aloca janela de terminal ao abrir o programa.
 * O agente usa caixas de dialogo (WinForms via PowerShell), nao precisa de console. */
'use strict';
const fs = require('node:fs');

const arquivo = process.argv[2];
if (!arquivo) { console.error('uso: node no-console.cjs <caminho.exe>'); process.exit(1); }

const buf = fs.readFileSync(arquivo);
if (buf.readUInt16LE(0) !== 0x5a4d) { console.error('nao parece um PE (sem assinatura MZ)'); process.exit(1); }
const peOff = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(peOff) !== 0x00004550) { console.error('assinatura PE\\0\\0 nao encontrada'); process.exit(1); }
// Optional Header comeca em peOff+24; campo Subsystem fica no offset 68 dele => peOff+0x5c.
const subOff = peOff + 0x5c;
const atual = buf.readUInt16LE(subOff);
const GUI = 2;
if (atual === GUI) { console.log('Subsystem ja era WINDOWS/GUI (2). Nada a fazer.'); process.exit(0); }
buf.writeUInt16LE(GUI, subOff);
fs.writeFileSync(arquivo, buf);
console.log(`Subsystem alterado de ${atual} (CONSOLE) para 2 (WINDOWS/GUI). Sem terminal preto.`);
