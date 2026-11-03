import * as MP4Box from "mp4box";

/** Extracts the first video track from an MP4 file for WebCodecs. */
export class MP4Demuxer {
  constructor(file, onConfig, onChunk, onDone, onError) {
    this.mp4File = MP4Box.createFile();
    this.onError = onError;
    this.onDone = onDone;
    this.totalSamples = 0;
    this.extractedSamples = 0;
    this.completionSent = false;
    this.isReady = false;

    this.mp4File.onError = (message) => {
      this.onError(new Error(`Could not read MP4: ${message}`));
    };

    this.mp4File.onReady = (info) => {
      try {
        this.isReady = true;
        const track = info.videoTracks?.[0];
        if (!track) throw new Error("This MP4 does not contain a video track.");

        const config = {
          codec: track.codec,
          bitrate: track.bitrate,
          codedHeight: track.video.height,
          codedWidth: track.video.width,
          nb_frames: track.nb_samples,
          description: this.getDescription(track),
        };
        this.totalSamples = track.nb_samples || 0;
        if (this.totalSamples === 0) {
          throw new Error("The MP4 video track contains no frames.");
        }

        if (!config.codedWidth || !config.codedHeight) {
          throw new Error("The MP4 video track has invalid dimensions.");
        }

        onConfig(config);
        this.mp4File.setExtractionOptions(track.id, null, { nbSamples: 32 });
        this.mp4File.start();
      } catch (error) {
        this.onError(error);
      }
    };

    this.mp4File.onSamples = (_trackId, _user, samples) => {
      try {
        for (const sample of samples) {
          onChunk(
            new EncodedVideoChunk({
              type: sample.is_sync ? "key" : "delta",
              timestamp: (1e6 * sample.cts) / sample.timescale,
              duration: (1e6 * sample.duration) / sample.timescale,
              data: sample.data,
            }),
          );
        }
        this.extractedSamples += samples.length;
        if (
          this.totalSamples > 0 &&
          this.extractedSamples >= this.totalSamples &&
          !this.completionSent
        ) {
          this.completionSent = true;
          this.onDone();
        }
      } catch (error) {
        this.onError(error);
      }
    };

    this.readFile(file);
  }

  getDescription(track) {
    const trak = this.mp4File.getTrackById(track.id);
    const sampleDescription = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
    const codecBox =
      sampleDescription?.avcC ||
      sampleDescription?.hvcC ||
      sampleDescription?.vpcC ||
      sampleDescription?.av1C;

    if (!codecBox) {
      throw new Error(`Unsupported MP4 codec configuration: ${track.codec || "unknown"}.`);
    }

    const stream = new MP4Box.DataStream(
      undefined,
      0,
      MP4Box.DataStream.BIG_ENDIAN,
    );
    codecBox.write(stream);
    return new Uint8Array(stream.buffer, 8);
  }

  async readFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      buffer.fileStart = 0;
      this.mp4File.appendBuffer(buffer);
      this.mp4File.flush();
      if (!this.isReady) {
        throw new Error("This file is not a complete MP4 video or its metadata is missing.");
      }
    } catch (error) {
      this.onError(error);
    }
  }

  pause() {
    this.mp4File.stop();
  }

  resume() {
    this.mp4File.start();
  }
}
