import CodeError from 'code-error';
import LazyBuilder from 'lazy-builder';
import micromatch from 'micromatch';
import path from 'path';
import {transform} from 'babel-core';
import convertSourceMap from 'convert-source-map';

const defaults = {
  include: '**/*.{js,jsx}',
  replaceExt: /\.(jsx|babel\.js)$/,
  sourceMaps: true,
};

export default function (options) {
  options = Object.assign({}, defaults, options);

  // remove special plugin-only options
  const include = options.include;
  delete options.include;
  const replaceExt = options.replaceExt;
  delete options.replaceExt;

  const included = micromatch.filter(include);

  let src;

  const builder = new LazyBuilder((file, contents) => {
    if (!included(file)) return contents;

    // replace extension for outgoing filename (if it's jsx or whatever)
    const jsFilename = replaceExt ? file.replace(replaceExt, '.js') : file;

    // compile the contents
    const source = contents.toString();
    let result;
    try {
      result = transform(source, Object.assign({}, options, {
        sourceRoot: src,
        filename: path.resolve(src, file),
      }));
    }
    catch (error) {
      throw new CodeError(error.message, {
        file,
        contents: source,
        line: error.loc ? error.loc.line : null,
        column: error.loc ? error.loc.column : null,
      });
    }

    if (options.sourceMaps) {
      delete result.map.file;
      delete result.map.sourceRoot;

      const comment = convertSourceMap
        .fromObject(result.map)
        .toComment();

      return {[jsFilename]: `${result.code}\n${comment}`};
    }

    return {[jsFilename]: result.code};
  });


  return function (files) {
    if (!src) src = this.src;

    return builder.build(files);
  };
}
