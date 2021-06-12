/**
 * Created by the STEM discord team 
 * @license LGPL-3.0
 */

const fs = require('fs');

class JsonDictionary {

    /**
     * @param {object} data
     * @param {string} data.path Absolute path to dictionary file.
     */
    constructor(data) {
        this.path = data.path;
        this.data = {};

        if (fs.existsSync(this.path)) this.data = JSON.parse(fs.readFileSync(this.path).toString());
        else this._save();
    }

    _save() {
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }

    get(key) {
        return this.data[key];
    }

    put(key, value) {
        if (this.data[key] === value) return;
        this.data[key] = value;
        this._save();
    }

    delete(key) {
        if (!(key in this.data)) return;
        delete this.data[key];
        this._save();
    }

}

module.exports = JsonDictionary;
