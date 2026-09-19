/* ============================================================================
   Описания слотов и базовая баллистика по каждому оружию.

   Координаты слотов заданы в системе конкретной модели (мм), взяты из её
   собственных узлов: ось канала ствола, верх крышки/планки, окно магазина.
   pos для планочного слота — центр верхней плоскости планки.
   ========================================================================== */
module.exports = {

  /* --------------------------------------------------------------- АК-74 */
  ak74: {
    title: 'АК-74',
    caliber: 'auto', weight: 3300,
    ballistics: { vertRecoil: 1.35, horizRecoil: 0.80, hipSpread: 2.6, adsTime: 0.30,
      mobility: 100, reloadTime: 2.48, muzzleVelocity: 900, effectiveRange: 400,
      loudness: 100, magCap: 30 },
    /* BORE = 75, крышка коробки ~ y=128, колодка прицела z=-248 */
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 75, -636], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 75, -300], rot: [0, 0, 0],
        accepts: ['handguard'], length: 240, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 122, -196], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-19, 96, -150], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 42, -122], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 48, 6], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'brake_ak', handguard: 'handguard_wood', mag: 'mag_ak_30',
      stock: 'stock_wood', optic: null, sidemount: null }
  },

  /* ---------------------------------------------------------------- АКМ */
  akm: {
    title: 'АКМ',
    caliber: 'auto', weight: 3600,
    ballistics: { vertRecoil: 1.70, horizRecoil: 1.05, hipSpread: 2.9, adsTime: 0.32,
      mobility: 96, reloadTime: 2.55, muzzleVelocity: 715, effectiveRange: 350,
      loudness: 106, magCap: 30 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 75, -600], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 75, -290], rot: [0, 0, 0],
        accepts: ['handguard'], length: 220, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 120, -192], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-19, 95, -148], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 42, -120], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 48, 8], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_cone', handguard: 'handguard_wood', mag: 'mag_ak_30',
      stock: 'stock_wood' }
  },

  /* --------------------------------------------------------------- M416 */
  m416: {
    title: 'M416',
    caliber: '5.56', weight: 3200,
    ballistics: { vertRecoil: 1.05, horizRecoil: 0.62, hipSpread: 2.2, adsTime: 0.27,
      mobility: 104, reloadTime: 2.30, muzzleVelocity: 880, effectiveRange: 420,
      loudness: 98, magCap: 30 },
    /* BORE = 70, верхняя планка ресивера y=98..104, длина цевья 240 */
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 70, -500], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 70, -110], rot: [0, 0, 0],
        accepts: ['handguard'], length: 260, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 104, -60], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 170, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 52, -92], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 58, 10], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_a2', handguard: 'handguard_mlok', mag: 'mag_stanag_30',
      stock: 'stock_telescopic', optic: 'reddot_t2' }
  },

  /* -------------------------------------------------------------- MP5A3 */
  mp5a3: {
    title: 'MP5A3',
    caliber: '9mm', weight: 2900,
    ballistics: { vertRecoil: 0.72, horizRecoil: 0.45, hipSpread: 1.9, adsTime: 0.23,
      mobility: 112, reloadTime: 2.35, muzzleVelocity: 400, effectiveRange: 180,
      loudness: 92, magCap: 30 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -232], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 0, -110], rot: [0, 0, 0],
        accepts: ['handguard'], length: 200, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 38, -40], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -24, -96], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 6, 108], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'thread_cap', mag: 'mag_pistol_33', stock: 'stock_telescopic' }
  },

  /* ------------------------------------------------------------- SCAR-H */
  scarh: {
    title: 'SCAR-H',
    caliber: '7.62', weight: 3580,
    ballistics: { vertRecoil: 1.55, horizRecoil: 0.95, hipSpread: 2.7, adsTime: 0.31,
      mobility: 94, reloadTime: 2.60, muzzleVelocity: 800, effectiveRange: 500,
      loudness: 104, magCap: 20 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -430], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 40, -60], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 200, order: 2, group: 'body' },
      { key: 'under', label: 'НИЖНЯЯ', type: 'rail', pos: [0, -26, -220], rot: [0, 0, Math.PI],
        accepts: ['under'], length: 110, order: 2, group: 'body' },
      { key: 'tactical', label: 'БОКОВАЯ', type: 'rail', pos: [-26, 0, -230], rot: [0, 0, Math.PI / 2],
        accepts: ['tactical'], length: 110, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -28, -120], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, -10, 20], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_a2', optic: 'reddot_t2', mag: 'mag_762_20',
      stock: 'stock_telescopic' }
  },

  /* ----------------------------------------------------------------- СВД */
  svd: {
    title: 'СВД',
    caliber: '7.62', weight: 4300,
    ballistics: { vertRecoil: 2.10, horizRecoil: 1.20, hipSpread: 3.4, adsTime: 0.38,
      mobility: 84, reloadTime: 2.90, muzzleVelocity: 830, effectiveRange: 800,
      loudness: 112, magCap: 10 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -560], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-18, 30, -140], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 44, -150], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier'], length: 260, order: 2, group: 'body' },
      { key: 'under', label: 'СОШКИ', type: 'rail', pos: [0, -26, -330], rot: [0, 0, Math.PI],
        accepts: ['under'], length: 100, order: 2, group: 'body' },
      { key: 'tactical', label: 'ТАКТИКА', type: 'rail', pos: [-24, -6, -300], rot: [0, 0, Math.PI / 2],
        accepts: ['tactical'], length: 100, order: 2, group: 'body' }
    ],
    /* приклад, магазин и штатный ПСО остаются от базовой модели винтовки */
    defaults: { muzzle: 'flash_cone', under: 'bipod' }
  },

  /* --------------------------------------------------------- Remington 870 */
  remington870: {
    title: 'Remington 870',
    caliber: '12ga', weight: 3600,
    ballistics: { vertRecoil: 3.20, horizRecoil: 1.60, hipSpread: 5.0, adsTime: 0.34,
      mobility: 92, reloadTime: 0.85, muzzleVelocity: 400, effectiveRange: 60,
      loudness: 118, magCap: 5 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -480], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 32, -60], rot: [0, 0, 0],
        accepts: ['optic', 'ironRear'], length: 120, order: 2, group: 'body' },
      { key: 'tactical', label: 'ФОНАРЬ', type: 'rail', pos: [-22, -8, -300], rot: [0, 0, Math.PI / 2],
        accepts: ['tactical'], length: 90, order: 2, group: 'body' }
    ],
    /* приклад и цевьё — от базовой модели ружья */
    defaults: { optic: 'reddot_rmr', tactical: 'light_tac' }
  },

  /* ---------------------------------------------------------- Glock 18C */
  glock18c: {
    title: 'Glock 18C',
    caliber: '9mm', weight: 620,
    ballistics: { vertRecoil: 0.95, horizRecoil: 0.70, hipSpread: 2.8, adsTime: 0.18,
      mobility: 126, reloadTime: 1.85, muzzleVelocity: 375, effectiveRange: 90,
      loudness: 94, magCap: 17 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -114], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 15, 40], rot: [0, 0, 0],
        accepts: ['optic'], length: 50, order: 2, group: 'slide' },
      { key: 'tactical', label: 'ФОНАРЬ', type: 'rail', pos: [0, -28, -62], rot: [0, 0, Math.PI],
        accepts: ['tactical'], length: 40, order: 2, group: 'body' }
    ],
    /* магазин — от базовой модели пистолета (он анимирован в перезарядке) */
    defaults: { optic: 'reddot_rmr' }
  }
};
