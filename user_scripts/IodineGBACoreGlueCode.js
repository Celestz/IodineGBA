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
var Iodine = null;
var Blitter = null;
var Mixer = null;
var MixerInput = null;
var timerID = null;
window.onload = function () {
    //Initialize Iodine:
    Iodine = new GameBoyAdvanceEmulator();
    //Initialize the graphics:
    registerBlitterHandler();
    //Initialize the audio:
    registerAudioHandler();
    //Register the save handler callbacks:
    registerSaveHandlers();
    //Hook the GUI controls.
    registerGUIEvents();
}
function registerBlitterHandler() {
    Blitter = new GlueCodeGfx();
    Blitter.attachCanvas(document.getElementById("emulator_target"));
    Iodine.attachGraphicsFrameHandler(function (buffer) {Blitter.copyBuffer(buffer);});
}
function registerAudioHandler() {
    Mixer = new GlueCodeMixer();
    MixerInput = new GlueCodeMixerInput(Mixer);
    Iodine.attachAudioHandler(MixerInput);
}
function registerGUIEvents() {
    addEvent("keydown", document, keyDown);
    addEvent("keyup", document, keyUpPreprocess);
    addEvent("change", document.getElementById("rom_load"), fileLoadROM);
    addEvent("change", document.getElementById("bios_load"), fileLoadBIOS);
    addEvent("click", document.getElementById("play"), function (event) {
             Iodine.play();
             this.style.display = "none";
             document.getElementById("pause").style.display = "inline";
             event.preventDefault();
             });
    addEvent("click", document.getElementById("pause"), function (event) {
             Iodine.pause();
             this.style.display = "none";
             document.getElementById("play").style.display = "inline";
             event.preventDefault();
             });
    addEvent("click", document.getElementById("restart"), function (event) {
             Iodine.restart();
             event.preventDefault();
             });
    document.getElementById("sound").checked = false;
    addEvent("click", document.getElementById("sound"), function () {
             if (this.checked) {
             Iodine.enableAudio();
             }
             else {
             Iodine.disableAudio();
             }
             });
    document.getElementById("skip_boot").checked = false;
    addEvent("click", document.getElementById("skip_boot"), function () {
             Iodine.toggleSkipBootROM(this.checked);
             });
    document.getElementById("lle_jit").checked = false;
    addEvent("click", document.getElementById("lle_jit"), function () {
             Iodine.toggleDynarec(this.checked);
             });
    document.getElementById("lineskip").checked = false;
    addEvent("click", document.getElementById("lineskip"), function () {
             Iodine.toggleLineSkip(this.checked);
             });
    document.getElementById("toggleSlowDownBusHack").checked = false;
    addEvent("click", document.getElementById("toggleSlowDownBusHack"), function () {
             Iodine.toggleSlowDownBusHack(this.checked);
             });
    document.getElementById("toggleSmoothScaling").checked = true;
    addEvent("click", document.getElementById("toggleSmoothScaling"), function () {
             if (Blitter) {
             Blitter.setSmoothScaling(this.checked);
             }
             });
    addEvent("unload", document, ExportSave);
    setInterval(
                function () {
                var speed = document.getElementById("speed");
                speed.textContent = "Speed: " + Iodine.getSpeedPercentage();
                }
                ,500);
}
function resetPlayButton() {
    document.getElementById("pause").style.display = "none";
    document.getElementById("play").style.display = "inline";
}
function lowerVolume() {
    var emuVolume = Math.max(Iodine.getVolume() - 0.04, 0);
    Iodine.changeVolume(emuVolume);
}
function raiseVolume() {
    var emuVolume = Math.min(Iodine.getVolume() + 0.04, 1);
    Iodine.changeVolume(emuVolume);
}
function writeRedTemporaryText(textString) {
    if (timerID) {
        clearTimeout(timerID);
    }
    document.getElementById("tempMessage").style.display = "block";
    document.getElementById("tempMessage").textContent = textString;
    timerID = setTimeout(clearTempString, 5000);
}
function clearTempString() {
    document.getElementById("tempMessage").style.display = "none";
}
//Some wrappers and extensions for non-DOM3 browsers:
function addEvent(sEvent, oElement, fListener) {
    try {
        oElement.addEventListener(sEvent, fListener, false);
    }
    catch (error) {
        oElement.attachEvent("on" + sEvent, fListener);    //Pity for IE.
    }
}
function removeEvent(sEvent, oElement, fListener) {
    try {
        oElement.removeEventListener(sEvent, fListener, false);
    }
    catch (error) {
        oElement.detachEvent("on" + sEvent, fListener);    //Pity for IE.
    }
}