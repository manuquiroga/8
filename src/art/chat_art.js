// 8 — emojis propios del chat (11x11, paleta "Cripta"). Se escriben en el texto como :id:
// OM.EMOTES: lista en el orden de la barra del chat. Sprites registrados como 'emo_<id>'.
window.OM = window.OM || {};
OM.ART_INIT = OM.ART_INIT || [];

OM.EMOTES = [
  { id: 'ocho', name: 'La 8' },
  { id: 'dentro', name: '¡Dentro!' },
  { id: 'taco', name: 'Taco' },
  { id: 'tiza', name: 'Tiza' },
  { id: 'fuego', name: 'En racha' },
  { id: 'calavera', name: 'Falta' },
  { id: 'jaja', name: 'Jaja' },
  { id: 'llora', name: 'Lloro' },
  { id: 'plata', name: 'Plata' },
  { id: 'gg', name: 'GG' },
];

OM.ART_INIT.push(function () {
  const R = {
    // bola 8: negra con aro de luz, disco blanco y el 8
    ocho: [
      '...44433...',
      '..4744333..',
      '.444888331.',
      '44481118331',
      '44481818331',
      '44381118321',
      '43381818321',
      '33381118221',
      '.333888221.',
      '..3322221..',
      '...11111...',
    ],
    // bola roja colándose en la tronera
    dentro: [
      '....bbb....',
      '...bdcbb...',
      '...bccba...',
      '.eebbbaaee.',
      'ef0abaaa0fe',
      'ef009a900fe',
      'ef0000000fe',
      'eff00000ffe',
      '.eeffffffe.',
      '..eeeeeee..',
      '...........',
    ],
    // taco en diagonal: punta con tiza, virola, madera y empuñadura
    taco: [
      '.........qq',
      '........q77',
      '.......g7..',
      '......gg...',
      '.....gf....',
      '....gf.....',
      '...ff......',
      '..ef.......',
      '.bb........',
      'ee.........',
      'e..........',
    ],
    // cubo de tiza azul con la marca del taco
    tiza: [
      '...........',
      '..rrrrrrr..',
      '.rrrrrrrrq.',
      '.rrr111rqq.',
      '.qrrrrrqqp.',
      '.qqqqqqqpp.',
      '.qqqqqqqpp.',
      '.qqqqqqqpp.',
      '.qqqqqqqpo.',
      '.ppppppppo.',
      '...........',
    ],
    // llama
    fuego: [
      '.....c.....',
      '....cc.....',
      '....cvc....',
      '...cvvc.c..',
      '..cvvhvccc.',
      '.cvvhhvvvc.',
      '.cvhhihhvc.',
      'cvvhiiihvvc',
      'cvhiiiiihvc',
      '.cvhiiihvc.',
      '..ccccccc..',
    ],
    // calavera de la cripta, ojos encendidos
    calavera: [
      '...........',
      '...77777...',
      '..7777777..',
      '.777777777.',
      '.700777007.',
      '.70c777c07.',
      '.777707777.',
      '..6777776..',
      '...70707...',
      '...67676...',
      '...........',
    ],
    // carcajada con lágrimas
    jaja: [
      '...ggggg...',
      '..ghhhhhg..',
      '.ghhhhhhhg.',
      'gh1hhhhh1hg',
      'ghh1hhh1hhg',
      'rhhhhhhhhhr',
      'rh1111111hr',
      'gh1bbbbb1hg',
      '.gh1ccc1hg.',
      '..ghh1hhg..',
      '...ggggg...',
    ],
    // llanto a mares
    llora: [
      '...ggggg...',
      '..ghhhhhg..',
      '.ghhhhhhhg.',
      'gh11hhh11hg',
      'ghrhhhhhrhg',
      'ghrhhhhhrhg',
      'grrh111hrrg',
      'grh1hhh1hrg',
      '.rhhhhhhhr.',
      '..rgggggr..',
      '...r...r...',
    ],
    // moneda de oro
    plata: [
      '...ggggg...',
      '..ghhhhhg..',
      '.ghihfhhhg.',
      'ghihfffhhhg',
      'ghihfhhhhhg',
      'ghhhfffhhhg',
      'ghhhhhfhhhg',
      'ghhhfffhhhg',
      '.ghhhfhhhg.',
      '..ggggggg..',
      '...fffff...',
    ],
    // insignia GG dorada
    gg: [
      '...........',
      '.ggggggggg.',
      'giiiiiiiiig',
      'gh111h111hg',
      'gh1hhh1hhhg',
      'gh1h1h1h1hg',
      'gh1h1h1h1hg',
      'gh111h111hg',
      'ghhhhhhhhhg',
      '.fffffffff.',
      '...........',
    ],
  };
  for (const id in R) OM.PX.sprite('emo_' + id, R[id]);
});
