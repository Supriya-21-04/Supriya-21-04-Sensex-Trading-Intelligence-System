import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def test_finbert():
    print("=" * 50)
    print("FINBERT SENTIMENT ANALYSIS TEST")
    print("=" * 50)

    # 1. Download ProsusAI/finbert from HuggingFace
    model_name = "ProsusAI/finbert"
    print(f"Downloading/Loading model: {model_name}...")
    
    # 2. Load tokenizer and classification model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    print("Model loaded successfully.\n")

    # 3. Test on 5 sample headlines manually
    headlines = [
        "Sensex surges 800 points as inflation cools down to a 5-year low.",
        "Indian economy faces massive recession warning amid global trade wars.",
        "Company XYZ announces standard quarterly earnings call next Tuesday.",
        "RBI abruptly hikes interest rates, causing massive panic selloffs in banks.",
        "Tech stocks rebound slightly after yesterday's muted performance."
    ]

    print("--- SCORING HEADLINES ---")
    
    model.eval() # Set model to evaluation mode
    
    for i, headline in enumerate(headlines, 1):
        # Tokenize the input text
        inputs = tokenizer(headline, return_tensors="pt", padding=True, truncation=True)
        
        # Perform inference
        with torch.no_grad():
            outputs = model(**inputs)
            
        # Extract probabilities using softmax
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
        
        # FinBERT labels: [positive, negative, neutral]
        labels = ['positive', 'negative', 'neutral']
        
        # Get the highest probability label
        predicted_class_idx = torch.argmax(probabilities, dim=1).item()
        predicted_label = labels[predicted_class_idx]
        confidence = probabilities[0][predicted_class_idx].item()
        
        print(f"\nHeadline {i}: \"{headline}\"")
        print(f"-> Sentiment: {predicted_label.upper()} (Confidence: {confidence:.2%})")
        print(f"-> Breakdown: Pos: {probabilities[0][0]:.2%}, Neg: {probabilities[0][1]:.2%}, Neu: {probabilities[0][2]:.2%}")

    print("\n" + "=" * 50)

if __name__ == "__main__":
    test_finbert()
