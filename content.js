// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillFormWithAI') {
    fillGoogleFormWithAI(request.apiKey).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Content script error:', error);
      sendResponse({
        success: false,
        message: 'An error occurred while processing the form'
      });
    });
    return true; // Keep message channel open for async response
  }
});

async function fillGoogleFormWithAI(apiKey) {
  try {
    console.log('Starting form analysis...');
    const questions = extractAllQuestions();
    
    console.log(`Found ${questions.length} questions:`, questions);
    
    if (questions.length === 0) {
      return {
        success: false,
        message: 'No answerable questions found on this page',
        filled: 0,
        total: 0
      };
    }

    let filledCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
      // Update progress
      try {
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          current: i + 1,
          total: questions.length
        });
      } catch (e) {
        // Ignore messaging errors
      }

      const question = questions[i];
      console.log(`Processing question ${i + 1}:`, question);
      
      let success = false;
      
      // Handle different question types
      switch (question.type) {
        case 'multiple_choice':
        case 'checkbox':
          success = await handleMultipleChoice(question, apiKey);
          break;
        case 'linear_scale':
          success = await handleLinearScale(question, apiKey);
          break;
        case 'dropdown':
          success = await handleDropdown(question, apiKey);
          break;
        case 'grid':
          success = await handleGrid(question, apiKey);
          break;
        case 'text':
          success = await handleTextQuestion(question, apiKey);
          break;
        default:
          console.log(`Unsupported question type: ${question.type}`);
      }
      
      if (success) {
        filledCount++;
      }
      
      // Delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      success: true,
      filled: filledCount,
      total: questions.length,
      message: `Successfully filled ${filledCount} out of ${questions.length} questions`
    };

  } catch (error) {
    console.error('Error filling form with AI:', error);
    return {
      success: false,
      message: 'Error occurred while processing questions',
      filled: 0,
      total: 0
    };
  }
}

function extractAllQuestions() {
  const questions = [];
  
  // Find all question containers - more comprehensive selectors
  const questionSelectors = [
    '.Qr7Oae',  // Main question container in newer forms
    '[role="listitem"]', // Question items
    '.freebirdFormviewerViewItemsItemItem', // Legacy selector
    '.geS5n', // Another container type
    '.m2', // Grid questions
  ];
  
  const questionContainers = document.querySelectorAll(questionSelectors.join(', '));
  console.log(`Found ${questionContainers.length} potential question containers`);
  
  questionContainers.forEach((container, index) => {
    try {
      const question = analyzeQuestion(container, index);
      if (question) {
        questions.push(question);
      }
    } catch (error) {
      console.warn(`Error analyzing question container ${index}:`, error);
    }
  });
  
  return questions;
}

function analyzeQuestion(container, index) {
  // Get question text
  const questionText = getQuestionText(container);
  if (!questionText) {
    console.log(`No question text found for container ${index}`);
    return null;
  }
  
  console.log(`Analyzing question: "${questionText}"`);
  
  // Determine question type and extract options
  let questionType = 'unknown';
  let options = [];
  let elements = [];
  
  // Check for multiple choice (radio buttons)
  const radioInputs = container.querySelectorAll('input[type="radio"]');
  if (radioInputs.length > 0) {
    questionType = 'multiple_choice';
    radioInputs.forEach(input => {
      const optionText = getOptionText(input);
      if (optionText) {
        options.push(optionText);
        elements.push(input);
      }
    });
  }
  
  // Check for checkboxes
  if (questionType === 'unknown') {
    const checkboxInputs = container.querySelectorAll('input[type="checkbox"]');
    if (checkboxInputs.length > 0) {
      questionType = 'checkbox';
      checkboxInputs.forEach(input => {
        const optionText = getOptionText(input);
        if (optionText) {
          options.push(optionText);
          elements.push(input);
        }
      });
    }
  }
  
  // Check for linear scale (rating)
  if (questionType === 'unknown') {
    const scaleContainer = container.querySelector('[role="radiogroup"]');
    if (scaleContainer) {
      const scaleInputs = scaleContainer.querySelectorAll('input[type="radio"]');
      if (scaleInputs.length > 0) {
        // Check if it's a numeric scale
        const labels = scaleContainer.querySelectorAll('[aria-label]');
        if (labels.length > 0 && /\d/.test(labels[0].getAttribute('aria-label'))) {
          questionType = 'linear_scale';
          scaleInputs.forEach((input, idx) => {
            options.push(`${idx + 1}`);
            elements.push(input);
          });
        }
      }
    }
  }
  
  // Check for dropdown
  if (questionType === 'unknown') {
    const select = container.querySelector('select');
    if (select) {
      questionType = 'dropdown';
      const selectOptions = select.querySelectorAll('option');
      selectOptions.forEach(option => {
        if (option.value && option.textContent.trim()) {
          options.push(option.textContent.trim());
          elements.push(option);
        }
      });
      // Store the select element as well
      if (elements.length > 0) {
        elements.selectElement = select;
      }
    }
  }
  
  // Check for grid questions
  if (questionType === 'unknown') {
    const gridRows = container.querySelectorAll('[role="radiogroup"]');
    if (gridRows.length > 1) {
      questionType = 'grid';
      // For grid questions, we'll handle each row separately
      const gridData = [];
      gridRows.forEach((row, rowIndex) => {
        const rowInputs = row.querySelectorAll('input[type="radio"]');
        if (rowInputs.length > 0) {
          gridData.push({
            rowIndex,
            inputs: Array.from(rowInputs),
            element: row
          });
        }
      });
      if (gridData.length > 0) {
        return {
          text: questionText,
          type: questionType,
          gridData: gridData,
          container: container
        };
      }
    }
  }
  
  // Check for text input
  if (questionType === 'unknown') {
    const textInput = container.querySelector('input[type="text"], textarea');
    if (textInput) {
      questionType = 'text';
      elements.push(textInput);
    }
  }
  
  if (questionType === 'unknown' || (options.length === 0 && questionType !== 'text')) {
    console.log(`Could not determine question type or no options found for: "${questionText}"`);
    return null;
  }
  
  return {
    text: questionText,
    type: questionType,
    options: options,
    elements: elements,
    container: container
  };
}

function getQuestionText(container) {
  const selectors = [
    '[role="heading"]',
    '.M7eMe', // Question text class
    '.freebirdFormviewerViewItemsItemItemTitle',
    '.Ap4rkd', // Another question text class
    'h2', 'h3', 'h4',
    '.geS5n .M7eMe'
  ];
  
  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

function getOptionText(input) {
  // Try multiple approaches to find option text
  const approaches = [
    // Method 1: aria-label
    () => input.getAttribute('aria-label'),
    
    // Method 2: closest label
    () => {
      const label = input.closest('label');
      return label ? label.textContent.trim() : null;
    },
    
    // Method 3: next sibling
    () => {
      const sibling = input.nextElementSibling;
      return sibling ? sibling.textContent.trim() : null;
    },
    
    // Method 4: parent text
    () => {
      const parent = input.parentElement;
      if (parent) {
        const text = parent.textContent.trim();
        // Filter out just the input value or empty text
        return text && text !== input.value ? text : null;
      }
      return null;
    },
    
    // Method 5: look for nearby spans
    () => {
      const span = input.parentElement?.querySelector('span');
      return span ? span.textContent.trim() : null;
    }
  ];
  
  for (const approach of approaches) {
    try {
      const text = approach();
      if (text && text.length > 0 && text !== input.value) {
        return text;
      }
    } catch (e) {
      continue;
    }
  }
  
  return `Option ${input.value || 'Unknown'}`;
}

async function handleMultipleChoice(question, apiKey) {
  try {
    const answer = await getAIAnswer(question.text, question.options, apiKey, 'multiple_choice');
    if (answer) {
      return selectMultipleChoiceAnswer(question, answer);
    }
  } catch (error) {
    console.error('Error handling multiple choice:', error);
  }
  return false;
}

async function handleLinearScale(question, apiKey) {
  try {
    const prompt = `Rate this on a scale from 1 to ${question.options.length}: "${question.text}". Respond with only the number (1, 2, 3, etc.):`;
    const response = await callAI(prompt, apiKey);
    
    // Extract number from response
    const numberMatch = response.match(/\b(\d+)\b/);
    if (numberMatch) {
      const rating = parseInt(numberMatch[1]);
      if (rating >= 1 && rating <= question.options.length) {
        const targetElement = question.elements[rating - 1];
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          targetElement.click();
          targetElement.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    }
    
    // Fallback: select middle option
    const middleIndex = Math.floor(question.options.length / 2);
    question.elements[middleIndex]?.click();
    return true;
  } catch (error) {
    console.error('Error handling linear scale:', error);
    return false;
  }
}

async function handleDropdown(question, apiKey) {
  try {
    const answer = await getAIAnswer(question.text, question.options, apiKey, 'dropdown');
    if (answer && question.elements.selectElement) {
      const select = question.elements.selectElement;
      const targetOption = Array.from(select.options).find(option => 
        option.textContent.trim().toLowerCase() === answer.toLowerCase()
      );
      
      if (targetOption) {
        select.value = targetOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
  } catch (error) {
    console.error('Error handling dropdown:', error);
  }
  return false;
}

async function handleGrid(question, apiKey) {
  try {
    let filledRows = 0;
    
    for (const rowData of question.gridData) {
      // For grid questions, we'll select a random option in each row
      // or use AI if we can determine what each row is asking
      const randomIndex = Math.floor(Math.random() * rowData.inputs.length);
      const targetInput = rowData.inputs[randomIndex];
      
      if (targetInput) {
        targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));
        targetInput.click();
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        filledRows++;
      }
      
      // Small delay between rows
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return filledRows > 0;
  } catch (error) {
    console.error('Error handling grid:', error);
    return false;
  }
}

async function handleTextQuestion(question, apiKey) {
  try {
    const prompt = `Provide a brief, appropriate answer for this question: "${question.text}". Keep it under 100 characters:`;
    const response = await callAI(prompt, apiKey);
    
    if (response && question.elements[0]) {
      const textElement = question.elements[0];
      textElement.value = response.trim();
      textElement.dispatchEvent(new Event('input', { bubbles: true }));
      textElement.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  } catch (error) {
    console.error('Error handling text question:', error);
  }
  return false;
}

async function getAIAnswer(questionText, options, apiKey, type) {
  try {
    let prompt;
    
    if (type === 'dropdown') {
      prompt = `Question: ${questionText}\n\nAvailable options: ${options.join(', ')}\n\nWhich option is most appropriate? Respond with the exact option text:`;
    } else {
      const optionsText = options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n');
      prompt = `Question: ${questionText}\n\nOptions:\n${optionsText}\n\nWhat is the correct answer? Respond with only the letter (A, B, C, D, etc.):`;
    }
    
    const response = await callAI(prompt, apiKey);
    
    if (type === 'dropdown') {
      // For dropdowns, try to match the response with available options
      const normalizedResponse = response.toLowerCase().trim();
      for (const option of options) {
        if (option.toLowerCase().includes(normalizedResponse) || 
            normalizedResponse.includes(option.toLowerCase())) {
          return option;
        }
      }
      return options[0]; // Fallback to first option
    } else {
      // For multiple choice, extract letter
      const letterMatch = response.match(/\b[A-Z]\b/);
      if (letterMatch) {
        const letterIndex = letterMatch[0].charCodeAt(0) - 65;
        if (letterIndex >= 0 && letterIndex < options.length) {
          return options[letterIndex];
        }
      }
      
      // Fallback: try text matching
      const normalizedResponse = response.toLowerCase();
      for (const option of options) {
        if (option.toLowerCase().includes(normalizedResponse) || 
            normalizedResponse.includes(option.toLowerCase())) {
          return option;
        }
      }
      
      return options[0]; // Final fallback
    }
  } catch (error) {
    console.error('AI API Error:', error);
    return options[Math.floor(Math.random() * options.length)];
  }
}

async function callAI(prompt, apiKey) {
  const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 20,
        temperature: 0.3,
        do_sample: true
      }
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data && data[0] && data[0].generated_text) {
    return data[0].generated_text.replace(prompt, '').trim();
  }
  
  return '';
}

function selectMultipleChoiceAnswer(question, answerText) {
  try {
    const matchingIndex = question.options.findIndex(opt => 
      opt.toLowerCase().trim() === answerText.toLowerCase().trim()
    );
    
    if (matchingIndex !== -1 && question.elements[matchingIndex]) {
      const targetElement = question.elements[matchingIndex];
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        targetElement.click();
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      }, 500);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error selecting answer:', error);
    return false;
  }
}
