"use strict";
/*
 * This file is part of IodineGBA
 *
 * Copyright (C) 2012-2013 Grant Galitz
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */
function GameBoyAdvanceFLASHChip() {
    this.saves = null;
    this.BANKOffset = 0;
    this.largestSizePossible = 0x10000;
}
GameBoyAdvanceFLASHChip.prototype.initialize = function () {
    this.allocate();
}
GameBoyAdvanceFLASHChip.prototype.allocate = function () {
    if (this.saves == null || (this.saves.length | 0) < (this.largestSizePossible | 0)) {
        //Allocate the new array:
        var newSave = getUint8Array(this.largestSizePossible | 0);
        //Copy the old save data out:
        if (this.saves != null) {
            for (var index = 0; (index | 0) < (this.saves.length | 0); index = ((index | 0) + 1) | 0) {
                newSave[index | 0] = this.saves[index | 0] | 0;
            }
        }
        //Assign the new array out:
        this.saves = newSave;
    }
}
GameBoyAdvanceFLASHChip.prototype.load = function (save) {
    if ((save.length | 0) == 0x10000 || (save.length | 0) == 0x20000) {
        this.saves = save;
    }
}
GameBoyAdvanceFLASHChip.prototype.read = function (address) {
    address = address | 0;
    address = address | this.BANKOffset;
    return this.saves[address & 0x1FFFF] | 0;
}
GameBoyAdvanceFLASHChip.prototype.write = function (address, data) {
    address = address | 0;
    data = data | 0;
    //Fill in
}
GameBoyAdvanceFLASHChip.prototype.selectBank = function (bankNumber) {
    bankNumber = bankNumber | 0;
    this.BANKOffset = (bankNumber & 0x1) << 16;
    this.largestSizePossible = Math.max((0x10000 + (this.BANKOffset | 0)) | 0, this.largestSizePossible | 0) | 0;
    this.allocate();
}