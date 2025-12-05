// MP3 encoding web worker using lame.js
importScripts('https://unpkg.com/lamejs@1.2.1/lame.min.js')

let lame, mp3Data

self.onmessage = function (e) {
  switch (e.data.cmd) {
    case 'init':
      const config = e.data.config
      lame = new lamejs.Mp3Encoder(
        1,
        config.sampleRate || 44100,
        config.bitRate || 128
      )
      mp3Data = []
      break

    case 'encode':
      const samples = e.data.buf
      const sampleBlockSize = 1152 // must be same as lame.LAME_MAXMP3BUFFER

      // Convert Float32Array to Int16Array
      const int16Buffer = new Int16Array(samples.length)
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }

      for (let i = 0; i < int16Buffer.length; i += sampleBlockSize) {
        const sampleChunk = int16Buffer.subarray(i, i + sampleBlockSize)
        const mp3buf = lame.encodeBuffer(sampleChunk)
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf)
        }
      }
      break

    case 'finish':
      // Flush remaining data
      const mp3buf = lame.flush()
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf)
      }

      self.postMessage({
        cmd: 'end',
        buf: mp3Data,
      })
      break

    default:
      self.postMessage({
        cmd: 'error',
        error: 'Unknown command: ' + e.data.cmd,
      })
  }
}
