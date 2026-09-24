export class RepetitionCodec {
    repetitions;
    constructor(repetitions = 3) {
        if (repetitions < 3 || repetitions % 2 === 0) {
            throw new Error('Repetition count must be an odd integer >= 3.');
        }
        this.repetitions = repetitions;
    }
    encode(data) {
        const out = new Uint8Array(data.length * this.repetitions);
        for (let i = 0; i < data.length; i++) {
            for (let r = 0; r < this.repetitions; r++)
                out[r * data.length + i] = data[i] & 1;
        }
        return out;
    }
    decode(data) {
        if (data.length % this.repetitions !== 0) {
            return { data: new Uint8Array(0), corrected: 0, success: false };
        }
        const out = new Uint8Array(data.length / this.repetitions);
        let corrected = 0;
        for (let i = 0; i < out.length; i++) {
            let ones = 0;
            for (let r = 0; r < this.repetitions; r++)
                ones += data[r * out.length + i] & 1;
            const bit = ones > this.repetitions / 2 ? 1 : 0;
            out[i] = bit;
            corrected += bit === 1 ? this.repetitions - ones : ones;
        }
        return { data: out, corrected, success: true };
    }
}
export const repetition3 = new RepetitionCodec(3);
//# sourceMappingURL=repetition.js.map