import { Project } from 'ts-morph';

async function fixTypes() {
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
  });

  // Find all source files
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    // Fix implicit any parameters
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const parameters = func.getParameters();
      for (const param of parameters) {
        if (!param.getTypeNode()) {
          // Add explicit type annotation
          param.setType('unknown');
        }
      }
    }

    // Fix missing return types
    for (const func of functions) {
      if (!func.getReturnTypeNode()) {
        const returnType = func.getReturnType();
        if (returnType.getText() !== 'any') {
          func.setReturnType(returnType.getText());
        }
      }
    }
  }

  // Save changes
  await project.save();
}

fixTypes();
