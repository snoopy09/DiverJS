var fs = require('fs');
var esprima = require('esprima');
var escodegen = require('escodegen');


function deleteComments (readFileName, writeFileName) {
  // とりあえずなんもなしで
  var original = fs.readFileSync(readFileName, 'utf8');
  var ast = esprima.parse(original, {
      // range: true,
      // tokens: true,
      // comment: true,
  });
  // ast = escodegen.attachComments(ast, ast.comments, ast.tokens);

  var generated = escodegen.generate(ast, {
      // format: {indent: {style: ''}},
      // comment: true,
      sourceCode: original,
      // format: {
      //   preserveBlankLines: true,
      // }
  });

  fs.writeFileSync(writeFileName, generated, 'utf8');

}

deleteComments(process.argv[2], process.argv[2]);
