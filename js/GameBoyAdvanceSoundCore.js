function GameBoyAdvanceSound(IOCore) {
	//Build references:
	this.IOCore = IOCore;
	this.emulatorCore = IOCore.emulatorCore;
	//Utilize the buffers present from the emulator core:
	this.currentBuffer = this.emulatorCore.audioCurrentBuffer;
	this.secondaryBuffer = this.emulatorCore.audioSecondaryBuffer;
	//Initialize start:
	this.dutyLookup = [								//Map the duty values given to ones we can work with.
		[false, false, false, false, false, false, false, true],
		[true, false, false, false, false, false, false, true],
		[true, false, false, false, false, true, true, true],
		[false, true, true, true, true, true, true, false]
	];
	this.initializePAPU();
}
GameBoyAdvanceSound.prototype.initializePAPU = function () {
	this.channel3PCM = getInt8Array(0x40);
	this.WAVERAM = getUint8Array(0x20);
	this.soundMasterEnabled = true;
	this.audioNumSamplesTotal = this.emulatorCore.audioNumSamplesTotal;
	this.intializeWhiteNoise();
	this.initializeAudioStartState();
}
GameBoyAdvanceSound.prototype.intializeWhiteNoise = function () {
	//Noise Sample Tables:
	var randomFactor = 1;
	//15-bit LSFR Cache Generation:
	this.LSFR15Table = getInt8Array(0x80000);
	var LSFR = 0x7FFF;	//Seed value has all its bits set.
	var LSFRShifted = 0x3FFF;
	for (var index = 0; index < 0x8000; ++index) {
		//Normalize the last LSFR value for usage:
		randomFactor = 1 - (LSFR & 1);	//Docs say it's the inverse.
		//Cache the different volume level results:
		this.LSFR15Table[0x08000 | index] = randomFactor;
		this.LSFR15Table[0x10000 | index] = randomFactor * 0x2;
		this.LSFR15Table[0x18000 | index] = randomFactor * 0x3;
		this.LSFR15Table[0x20000 | index] = randomFactor * 0x4;
		this.LSFR15Table[0x28000 | index] = randomFactor * 0x5;
		this.LSFR15Table[0x30000 | index] = randomFactor * 0x6;
		this.LSFR15Table[0x38000 | index] = randomFactor * 0x7;
		this.LSFR15Table[0x40000 | index] = randomFactor * 0x8;
		this.LSFR15Table[0x48000 | index] = randomFactor * 0x9;
		this.LSFR15Table[0x50000 | index] = randomFactor * 0xA;
		this.LSFR15Table[0x58000 | index] = randomFactor * 0xB;
		this.LSFR15Table[0x60000 | index] = randomFactor * 0xC;
		this.LSFR15Table[0x68000 | index] = randomFactor * 0xD;
		this.LSFR15Table[0x70000 | index] = randomFactor * 0xE;
		this.LSFR15Table[0x78000 | index] = randomFactor * 0xF;
		//Recompute the LSFR algorithm:
		LSFRShifted = LSFR >> 1;
		LSFR = LSFRShifted | (((LSFRShifted ^ LSFR) & 0x1) << 14);
	}
	//7-bit LSFR Cache Generation:
	this.LSFR7Table = getInt8Array(0x800);
	LSFR = 0x7F;	//Seed value has all its bits set.
	for (index = 0; index < 0x80; ++index) {
		//Normalize the last LSFR value for usage:
		randomFactor = 1 - (LSFR & 1);	//Docs say it's the inverse.
		//Cache the different volume level results:
		this.LSFR7Table[0x080 | index] = randomFactor;
		this.LSFR7Table[0x100 | index] = randomFactor * 0x2;
		this.LSFR7Table[0x180 | index] = randomFactor * 0x3;
		this.LSFR7Table[0x200 | index] = randomFactor * 0x4;
		this.LSFR7Table[0x280 | index] = randomFactor * 0x5;
		this.LSFR7Table[0x300 | index] = randomFactor * 0x6;
		this.LSFR7Table[0x380 | index] = randomFactor * 0x7;
		this.LSFR7Table[0x400 | index] = randomFactor * 0x8;
		this.LSFR7Table[0x480 | index] = randomFactor * 0x9;
		this.LSFR7Table[0x500 | index] = randomFactor * 0xA;
		this.LSFR7Table[0x580 | index] = randomFactor * 0xB;
		this.LSFR7Table[0x600 | index] = randomFactor * 0xC;
		this.LSFR7Table[0x680 | index] = randomFactor * 0xD;
		this.LSFR7Table[0x700 | index] = randomFactor * 0xE;
		this.LSFR7Table[0x780 | index] = randomFactor * 0xF;
		//Recompute the LSFR algorithm:
		LSFRShifted = LSFR >> 1;
		LSFR = LSFRShifted | (((LSFRShifted ^ LSFR) & 0x1) << 6);
	}
}
GameBoyAdvanceSound.prototype.initializeAudioStartState = function () {
	this.channel1FrequencyTracker = 0x2000;
	this.channel1DutyTracker = 0;
	this.channel1CachedDuty = this.dutyLookup[2];
	this.channel1totalLength = 0;
	this.channel1envelopeVolume = 0;
	this.channel1envelopeType = false;
	this.channel1envelopeSweeps = 0;
	this.channel1envelopeSweepsLast = 0;
	this.channel1consecutive = true;
	this.channel1frequency = 0;
	this.channel1SweepFault = false;
	this.channel1ShadowFrequency = 0;
	this.channel1timeSweep = 1;
	this.channel1lastTimeSweep = 0;
	this.channel1numSweep = 0;
	this.channel1frequencySweepDivider = 0;
	this.channel1decreaseSweep = false;
	this.channel2FrequencyTracker = 0x2000;
	this.channel2DutyTracker = 0;
	this.channel2CachedDuty = this.dutyLookup[2];
	this.channel2totalLength = 0;
	this.channel2envelopeVolume = 0;
	this.channel2envelopeType = false;
	this.channel2envelopeSweeps = 0;
	this.channel2envelopeSweepsLast = 0;
	this.channel2consecutive = true;
	this.channel2frequency = 0;
	this.channel3canPlay = false;
	this.channel3totalLength = 0;
	this.channel3patternType = 4;
	this.channel3frequency = 0;
	this.channel3consecutive = true;
	this.channel3Counter = 0x800;
	this.channel4FrequencyPeriod = 8;
	this.channel4totalLength = 0;
	this.channel4envelopeVolume = 0;
	this.channel4currentVolume = 0;
	this.channel4envelopeType = false;
	this.channel4envelopeSweeps = 0;
	this.channel4envelopeSweepsLast = 0;
	this.channel4consecutive = true;
	this.channel4BitRange = 0x7FFF;
	this.noiseSampleTable = this.LSFR15Table;
	this.channel4VolumeShifter = 15;
	this.channel1FrequencyCounter = 0x2000;
	this.channel2FrequencyCounter = 0x2000;
	this.channel3Counter = 0x800;
	this.channel3FrequencyPeriod = 0x800;
	this.channel3lastSampleLookup = 0;
	this.channel4lastSampleLookup = 0;
	this.VinLeftChannelMasterVolume = 8;
	this.VinRightChannelMasterVolume = 8;
	this.CGBMixerOutputCacheLeft = 0;
	this.CGBMixerOutputCacheLeftFolded = 0;
	this.CGBMixerOutputCacheRight = 0;
	this.CGBMixerOutputCacheRightFolded = 0;
	this.AGBDirectSoundA = 0;
	this.AGBDirectSoundAFolded = 0;
	this.AGBDirectSoundB = 0;
	this.AGBDirectSoundBFolded = 0;
	this.AGBDirectSoundAShifter = 0;
	this.AGBDirectSoundBShifter = 0;
	this.AGBDirectSoundALeftCanPlay = false;
	this.AGBDirectSoundBLeftCanPlay = false;
	this.AGBDirectSoundARightCanPlay = false;
	this.AGBDirectSoundBRightCanPlay = false;
	this.mixerSoundBIAS = 0;
	this.mixerOutputCache = 0;
	this.sequencerClocks = 0x2000;
	this.sequencePosition = 0;
	this.channel4FrequencyPeriod = 8;
	this.channel4Counter = 8;
	this.cachedChannel3Sample = 0;
	this.cachedChannel4Sample = 0;
	this.channel3WAVERAMBankSpecified = 0;
	this.CGBOutputRatio = 0;
	this.channel1Enabled = false;
	this.channel2Enabled = false;
	this.channel3Enabled = false;
	this.channel4Enabled = false;
	this.channel1canPlay = false;
	this.channel2canPlay = false;
	this.channel4canPlay = false;
	this.channel1OutputLevelCache();
	this.channel2OutputLevelCache();
	this.channel3OutputLevelCache();
	this.channel4OutputLevelCache();
}
//Below are the audio generation functions timed against the CPU:
GameBoyAdvanceSound.prototype.generateAudio = function (numSamples) {
	if (!this.soundMasterEnabled && this.IOCore.systemStatus < 4) {
		for (var samplesToGenerate = 0; numSamples > 0;) {
			samplesToGenerate = (numSamples < this.sequencerClocks) ? numSamples : this.sequencerClocks;
			this.sequencerClocks -= samplesToGenerate;
			numSamples -= samplesToGenerate;
			while (--samplesToGenerate > -1) {
				this.computeAudioChannels();
				this.currentBuffer[this.audioIndex++] = this.mixerOutputCache;
				if (this.audioIndex == this.audioNumSamplesTotal) {
					this.audioIndex = 0;
					this.outputAudio();
				}
			}
			if (this.sequencerClocks == 0) {
				this.audioComputeSequencer();
				this.sequencerClocks = 0x2000;
			}
		}
	}
	else {
		//SILENT OUTPUT:
		while (--numSamples > -1) {
			this.currentBuffer[this.audioIndex++] = 0;
			if (this.audioIndex == this.audioNumSamplesTotal) {
				this.audioIndex = 0;
				this.outputAudio();
			}
		}
	}
}
//Generate audio, but don't actually output it (Used for when sound is disabled by user/browser):
GameBoyAdvanceSound.prototype.generateAudioFake = function (numSamples) {
	if (!this.soundMasterEnabled && this.IOCore.systemStatus < 4) {
		while (--numSamples > -1) {
			this.computeAudioChannels();
			if (--this.sequencerClocks == 0) {
				this.audioComputeSequencer();
				this.sequencerClocks = 0x2000;
			}
		}
	}
}
GameBoyAdvanceSound.prototype.audioJIT = function () {
	//Audio Sample Generation Timing:
	if (settings[0]) {
		this.generateAudio(this.audioTicks);
	}
	else {
		this.generateAudioFake(this.audioTicks);
	}
	this.audioTicks = 0;
}
GameBoyAdvanceSound.prototype.audioComputeSequencer = function () {
	switch (this.sequencePosition++) {
		case 0:
			this.clockAudioLength();
			break;
		case 2:
			this.clockAudioLength();
			this.clockAudioSweep();
			break;
		case 4:
			this.clockAudioLength();
			break;
		case 6:
			this.clockAudioLength();
			this.clockAudioSweep();
			break;
		case 7:
			this.clockAudioEnvelope();
			this.sequencePosition = 0;
	}
}
GameBoyAdvanceSound.prototype.clockAudioLength = function () {
	//Channel 1:
	if (this.channel1totalLength > 1) {
		--this.channel1totalLength;
	}
	else if (this.channel1totalLength == 1) {
		this.channel1totalLength = 0;
		this.channel1EnableCheck();
		this.memory[0xFF26] &= 0xFE;	//Channel #1 On Flag Off
	}
	//Channel 2:
	if (this.channel2totalLength > 1) {
		--this.channel2totalLength;
	}
	else if (this.channel2totalLength == 1) {
		this.channel2totalLength = 0;
		this.channel2EnableCheck();
		this.memory[0xFF26] &= 0xFD;	//Channel #2 On Flag Off
	}
	//Channel 3:
	if (this.channel3totalLength > 1) {
		--this.channel3totalLength;
	}
	else if (this.channel3totalLength == 1) {
		this.channel3totalLength = 0;
		this.channel3EnableCheck();
		this.memory[0xFF26] &= 0xFB;	//Channel #3 On Flag Off
	}
	//Channel 4:
	if (this.channel4totalLength > 1) {
		--this.channel4totalLength;
	}
	else if (this.channel4totalLength == 1) {
		this.channel4totalLength = 0;
		this.channel4EnableCheck();
		this.memory[0xFF26] &= 0xF7;	//Channel #4 On Flag Off
	}
}
GameBoyAdvanceSound.prototype.clockAudioSweep = function () {
	//Channel 1:
	if (!this.channel1SweepFault && this.channel1timeSweep > 0) {
		if (--this.channel1timeSweep == 0) {
			this.runAudioSweep();
		}
	}
}
GameBoyAdvanceSound.prototype.runAudioSweep = function () {
	//Channel 1:
	if (this.channel1lastTimeSweep > 0) {
		if (this.channel1frequencySweepDivider > 0) {
			if (this.channel1numSweep > 0) {
				--this.channel1numSweep;
				if (this.channel1decreaseSweep) {
					this.channel1ShadowFrequency -= this.channel1ShadowFrequency >> this.channel1frequencySweepDivider;
					this.channel1frequency = this.channel1ShadowFrequency & 0x7FF;
					this.channel1FrequencyTracker = (0x800 - this.channel1frequency) << 2;
				}
				else {
					this.channel1ShadowFrequency += this.channel1ShadowFrequency >> this.channel1frequencySweepDivider;
					this.channel1frequency = this.channel1ShadowFrequency;
					if (this.channel1ShadowFrequency <= 0x7FF) {
						this.channel1FrequencyTracker = (0x800 - this.channel1frequency) << 2;
						//Run overflow check twice:
						if ((this.channel1ShadowFrequency + (this.channel1ShadowFrequency >> this.channel1frequencySweepDivider)) > 0x7FF) {
							this.channel1SweepFault = true;
							this.channel1EnableCheck();
							this.memory[0xFF26] &= 0xFE;	//Channel #1 On Flag Off
						}
					}
					else {
						this.channel1frequency &= 0x7FF;
						this.channel1SweepFault = true;
						this.channel1EnableCheck();
						this.memory[0xFF26] &= 0xFE;	//Channel #1 On Flag Off
					}
				}
			}
			this.channel1timeSweep = this.channel1lastTimeSweep;
		}
		else {
			//Channel has sweep disabled and timer becomes a length counter:
			this.channel1SweepFault = true;
			this.channel1EnableCheck();
		}
	}
}
GameBoyAdvanceSound.prototype.channel1AudioSweepPerformDummy = function () {
	//Channel 1:
	if (this.channel1numSweep > 0) {
		if (!this.channel1decreaseSweep) {
			var channel1ShadowFrequency = this.channel1ShadowFrequency + (this.channel1ShadowFrequency >> this.channel1frequencySweepDivider);
			if (channel1ShadowFrequency <= 0x7FF) {
				//Run overflow check twice:
				if ((channel1ShadowFrequency + (channel1ShadowFrequency >> this.channel1frequencySweepDivider)) > 0x7FF) {
					this.channel1SweepFault = true;
					this.channel1EnableCheck();
					this.memory[0xFF26] &= 0xFE;	//Channel #1 On Flag Off
				}
			}
			else {
				this.channel1SweepFault = true;
				this.channel1EnableCheck();
				this.memory[0xFF26] &= 0xFE;	//Channel #1 On Flag Off
			}
		}
	}
}
GameBoyAdvanceSound.prototype.clockAudioEnvelope = function () {
	//Channel 1:
	if (this.channel1envelopeSweepsLast > -1) {
		if (this.channel1envelopeSweeps > 0) {
			--this.channel1envelopeSweeps;
		}
		else {
			if (!this.channel1envelopeType) {
				if (this.channel1envelopeVolume > 0) {
					--this.channel1envelopeVolume;
					this.channel1envelopeSweeps = this.channel1envelopeSweepsLast;
					this.channel1OutputLevelCache();
				}
				else {
					this.channel1envelopeSweepsLast = -1;
				}
			}
			else if (this.channel1envelopeVolume < 0xF) {
				++this.channel1envelopeVolume;
				this.channel1envelopeSweeps = this.channel1envelopeSweepsLast;
				this.channel1OutputLevelCache();
			}
			else {
				this.channel1envelopeSweepsLast = -1;
			}
		}
	}
	//Channel 2:
	if (this.channel2envelopeSweepsLast > -1) {
		if (this.channel2envelopeSweeps > 0) {
			--this.channel2envelopeSweeps;
		}
		else {
			if (!this.channel2envelopeType) {
				if (this.channel2envelopeVolume > 0) {
					--this.channel2envelopeVolume;
					this.channel2envelopeSweeps = this.channel2envelopeSweepsLast;
					this.channel2OutputLevelCache();
				}
				else {
					this.channel2envelopeSweepsLast = -1;
				}
			}
			else if (this.channel2envelopeVolume < 0xF) {
				++this.channel2envelopeVolume;
				this.channel2envelopeSweeps = this.channel2envelopeSweepsLast;
				this.channel2OutputLevelCache();
			}
			else {
				this.channel2envelopeSweepsLast = -1;
			}
		}
	}
	//Channel 4:
	if (this.channel4envelopeSweepsLast > -1) {
		if (this.channel4envelopeSweeps > 0) {
			--this.channel4envelopeSweeps;
		}
		else {
			if (!this.channel4envelopeType) {
				if (this.channel4envelopeVolume > 0) {
					this.channel4currentVolume = --this.channel4envelopeVolume << this.channel4VolumeShifter;
					this.channel4envelopeSweeps = this.channel4envelopeSweepsLast;
					this.channel4UpdateCache();
				}
				else {
					this.channel4envelopeSweepsLast = -1;
				}
			}
			else if (this.channel4envelopeVolume < 0xF) {
				this.channel4currentVolume = ++this.channel4envelopeVolume << this.channel4VolumeShifter;
				this.channel4envelopeSweeps = this.channel4envelopeSweepsLast;
				this.channel4UpdateCache();
			}
			else {
				this.channel4envelopeSweepsLast = -1;
			}
		}
	}
}
GameBoyAdvanceSound.prototype.computeAudioChannels = function () {
	//Channel 1 counter:
	if (--this.channel1FrequencyCounter == 0) {
		this.channel1FrequencyCounter = this.channel1FrequencyTracker;
		this.channel1DutyTracker = (this.channel1DutyTracker + 1) & 0x7;
		this.channel1OutputLevelTrimaryCache();
	}
	//Channel 2 counter:
	if (--this.channel2FrequencyCounter == 0) {
		this.channel2FrequencyCounter = this.channel2FrequencyTracker;
		this.channel2DutyTracker = (this.channel2DutyTracker + 1) & 0x7;
		this.channel2OutputLevelTrimaryCache();
	}
	//Channel 3 counter:
	if (--this.channel3Counter == 0) {
		if (this.channel3canPlay) {
			this.channel3lastSampleLookup = (this.channel3lastSampleLookup + 1) & this.channel3WaveRAMBankSize;
		}
		this.channel3Counter = this.channel3FrequencyPeriod;
		this.channel3UpdateCache();
	}
	//Channel 4 counter:
	if (--this.channel4Counter == 0) {
		this.channel4lastSampleLookup = (this.channel4lastSampleLookup + 1) & this.channel4BitRange;
		this.channel4Counter = this.channel4FrequencyPeriod;
		this.channel4UpdateCache();
	}
}
GameBoyAdvanceSound.prototype.channel1EnableCheck = function () {
	this.channel1Enabled = ((this.channel1consecutive || this.channel1totalLength > 0) && !this.channel1SweepFault && this.channel1canPlay);
	this.channel1OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel1VolumeEnableCheck = function () {
	this.channel1canPlay = (this.memory[0xFF12] > 7);
	this.channel1EnableCheck();
	this.channel1OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel1OutputLevelCache = function () {
	this.channel1currentSampleLeft = (this.leftChannel1) ? this.channel1envelopeVolume : 0;
	this.channel1currentSampleRight = (this.rightChannel1) ? this.channel1envelopeVolume : 0;
	this.channel1OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel1OutputLevelSecondaryCache = function () {
	if (this.channel1Enabled) {
		this.channel1currentSampleLeftSecondary = this.channel1currentSampleLeft;
		this.channel1currentSampleRightSecondary = this.channel1currentSampleRight;
	}
	else {
		this.channel1currentSampleLeftSecondary = 0;
		this.channel1currentSampleRightSecondary = 0;
	}
	this.channel1OutputLevelTrimaryCache();
}
GameBoyAdvanceSound.prototype.channel1OutputLevelTrimaryCache = function () {
	if (this.channel1CachedDuty[this.channel1DutyTracker]) {
		this.channel1currentSampleLeftTrimary = this.channel1currentSampleLeftSecondary;
		this.channel1currentSampleRightTrimary = this.channel1currentSampleRightSecondary;
	}
	else {
		this.channel1currentSampleLeftTrimary = 0;
		this.channel1currentSampleRightTrimary = 0;
	}
	this.CGBMixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.channel2EnableCheck = function () {
	this.channel2Enabled = ((this.channel2consecutive || this.channel2totalLength > 0) && this.channel2canPlay);
	this.channel2OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel2VolumeEnableCheck = function () {
	this.channel2canPlay = (this.memory[0xFF17] > 7);
	this.channel2EnableCheck();
	this.channel2OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel2OutputLevelCache = function () {
	this.channel2currentSampleLeft = (this.leftChannel2) ? this.channel2envelopeVolume : 0;
	this.channel2currentSampleRight = (this.rightChannel2) ? this.channel2envelopeVolume : 0;
	this.channel2OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel2OutputLevelSecondaryCache = function () {
	if (this.channel2Enabled) {
		this.channel2currentSampleLeftSecondary = this.channel2currentSampleLeft;
		this.channel2currentSampleRightSecondary = this.channel2currentSampleRight;
	}
	else {
		this.channel2currentSampleLeftSecondary = 0;
		this.channel2currentSampleRightSecondary = 0;
	}
	this.channel2OutputLevelTrimaryCache();
}
GameBoyAdvanceSound.prototype.channel2OutputLevelTrimaryCache = function () {
	if (this.channel2CachedDuty[this.channel2DutyTracker]) {
		this.channel2currentSampleLeftTrimary = this.channel2currentSampleLeftSecondary;
		this.channel2currentSampleRightTrimary = this.channel2currentSampleRightSecondary;
	}
	else {
		this.channel2currentSampleLeftTrimary = 0;
		this.channel2currentSampleRightTrimary = 0;
	}
	this.CGBMixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.channel3EnableCheck = function () {
	this.channel3Enabled = (/*this.channel3canPlay && */(this.channel3consecutive || this.channel3totalLength > 0));
	this.channel3OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel3OutputLevelCache = function () {
	this.channel3currentSampleLeft = (this.leftChannel3) ? this.cachedChannel3Sample : 0;
	this.channel3currentSampleRight = (this.rightChannel3) ? this.cachedChannel3Sample : 0;
	this.channel3OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel3OutputLevelSecondaryCache = function () {
	if (this.channel3Enabled) {
		this.channel3currentSampleLeftSecondary = this.channel3currentSampleLeft;
		this.channel3currentSampleRightSecondary = this.channel3currentSampleRight;
	}
	else {
		this.channel3currentSampleLeftSecondary = 0;
		this.channel3currentSampleRightSecondary = 0;
	}
	this.CGBMixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.channel4EnableCheck = function () {
	this.channel4Enabled = ((this.channel4consecutive || this.channel4totalLength > 0) && this.channel4canPlay);
	this.channel4OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel4VolumeEnableCheck = function () {
	this.channel4canPlay = (this.memory[0xFF21] > 7);
	this.channel4EnableCheck();
	this.channel4OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel4OutputLevelCache = function () {
	this.channel4currentSampleLeft = (this.leftChannel4) ? this.cachedChannel4Sample : 0;
	this.channel4currentSampleRight = (this.rightChannel4) ? this.cachedChannel4Sample : 0;
	this.channel4OutputLevelSecondaryCache();
}
GameBoyAdvanceSound.prototype.channel4OutputLevelSecondaryCache = function () {
	if (this.channel4Enabled) {
		this.channel4currentSampleLeftSecondary = this.channel4currentSampleLeft;
		this.channel4currentSampleRightSecondary = this.channel4currentSampleRight;
	}
	else {
		this.channel4currentSampleLeftSecondary = 0;
		this.channel4currentSampleRightSecondary = 0;
	}
	this.CGBMixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.CGBMixerOutputLevelCache = function () {
	this.CGBMixerOutputCacheLeft = (this.channel1currentSampleLeftTrimary + this.channel2currentSampleLeftTrimary + this.channel3currentSampleLeftSecondary + this.channel4currentSampleLeftSecondary) * this.VinLeftChannelMasterVolume;
	this.CGBMixerOutputCacheRight = (this.channel1currentSampleRightTrimary + this.channel2currentSampleRightTrimary + this.channel3currentSampleRightSecondary + this.channel4currentSampleRightSecondary) * this.VinRightChannelMasterVolume;
	this.CGBFolder();
}
GameBoyAdvanceSound.prototype.channel3UpdateCache = function () {
	if (this.channel3patternType < 5) {
		this.cachedChannel3Sample = this.channel3PCM[this.channel3lastSampleLookup] >> this.channel3patternType;
	}
	else {
		this.cachedChannel3Sample = (this.channel3PCM[this.channel3lastSampleLookup] * 0.75) | 0;
	}
	this.channel3OutputLevelCache();
}
GameBoyAdvanceSound.prototype.writeWAVE = function (address, data) {
	if (this.channel3canPlay) {
		this.audioJIT();
	}
	address += (1 - this.channel3WAVERAMBankSpecified) << 4;
	this.WAVERAM[address] = data;
	address <<= 1;
	this.channel3PCM[address] = data >> 4;
	this.channel3PCM[address | 1] = data & 0xF;
}
GameBoyAdvanceSound.prototype.readWAVE = function (address) {
	return this.WAVERAM[address + ((1 - this.channel3WAVERAMBankSpecified) << 4)];
}
GameBoyAdvanceSound.prototype.channel4UpdateCache = function () {
	this.cachedChannel4Sample = this.noiseSampleTable[this.channel4currentVolume | this.channel4lastSampleLookup];
	this.channel4OutputLevelCache();
}
GameBoyAdvanceSound.prototype.writeFIFOA = function (data) {
	if (this.FIFOABuffer.length < 8) {
		this.FIFOABuffer.push(data);
	}
}
GameBoyAdvanceSound.prototype.writeFIFOB = function (data) {
	if (this.FIFOBBuffer.length < 8) {
		this.FIFOBBuffer.push(data);
	}
}
GameBoyAdvanceSound.prototype.AGBDirectSoundAFIFOClear = function () {
	this.AGBDirectSoundA = 0;
	this.FIFOABuffer = [];
	this.AGBFIFOAFolder();
}
GameBoyAdvanceSound.prototype.AGBDirectSoundBFIFOClear = function () {
	this.AGBDirectSoundB = 0;
	this.FIFOBBuffer = [];
	this.AGBFIFOBFolder();
}
GameBoyAdvanceSound.prototype.AGBDirectSoundATimerIncrement = function () {
	this.AGBDirectSoundA = (this.FIFOABuffer.length) ? ((this.FIFOABuffer.shift() << 24) >> 22) : 0;
	if (this.FIFOBBuffer.length < 5) {
		this.IOCore.dma.soundFIFOARequest();
	}
	this.AGBFIFOAFolder();
}
GameBoyAdvanceSound.prototype.AGBDirectSoundBTimerIncrement = function () {
	this.AGBDirectSoundB = (this.FIFOBBuffer.length) ? ((this.FIFOBBuffer.shift() << 24) >> 22) : 0;
	if (this.FIFOBBuffer.length < 5) {
		this.IOCore.dma.soundFIFOBRequest();
	}
	this.AGBFIFOBFolder();
}
GameBoyAdvanceSound.prototype.AGBFIFOAFolder = function () {
	this.AGBDirectSoundAFolded = this.AGBDirectSoundA >> this.AGBDirectSoundAShifter;
	this.mixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.AGBFIFOBFolder = function () {
	this.AGBDirectSoundBFolded = this.AGBDirectSoundB >> this.AGBDirectSoundBShifter;
	this.mixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.CGBFolder = function () {
	this.CGBMixerOutputCacheLeftFolded = (this.CGBMixerOutputCacheLeft << 1) >> this.CGBOutputRatio;
	this.CGBMixerOutputCacheRightFolded = (this.CGBMixerOutputCacheRight << 1) >> this.CGBOutputRatio;
	this.mixerOutputLevelCache();
}
GameBoyAdvanceSound.prototype.mixerOutputLevelCache = function () {
	var leftSample = Math.min(Math.max(((this.AGBDirectSoundALeftCanPlay) ? this.AGBDirectSoundAFolded : 0) +
	((this.AGBDirectSoundBLeftCanPlay) ? this.AGBDirectSoundBFolded : 0) +
	this.CGBMixerOutputCacheLeftFolded +
	this.mixerSoundBIAS, 0), 0x3FF);
	var rightSample = Math.min(Math.max(((this.AGBDirectSoundARightCanPlay) ? this.AGBDirectSoundAFolded : 0) +
	((this.AGBDirectSoundBRightCanPlay) ? this.AGBDirectSoundBFolded : 0) +
	this.CGBMixerOutputCacheRightFolded +
	this.mixerSoundBIAS, 0), 0x3FF);
	this.mixerOutputCache = (leftSample << 10) + rightSample;
}