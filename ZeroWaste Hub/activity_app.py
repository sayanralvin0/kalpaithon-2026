import os
from flask import Flask, render_template, request

# This tells Python exactly where your project is
base_dir = os.path.abspath(os.path.dirname(__file__))
template_dir = os.path.join(base_dir, 'templates')

app = Flask(__name__, template_folder=template_dir)

@app.route('/')
def show_activity():
    return render_template('activity.html', result=None)

@app.route('/check-trend', methods=['POST'])
def check_trend():
    # Step 1 & 2: 7-Day Average Data
    history = [5.2, 4.8, 6.1, 5.5, 5.0, 4.9, 5.3]
    avg = sum(history) / len(history)
    
    try:
        today_val = float(request.form.get('amount'))
    except (TypeError, ValueError):
        today_val = 0
    
    # Step 4: 30% Threshold Logic
    is_high = today_val > (avg * 1.3)
    
    result = {
        "today": today_val,
        "avg": round(avg, 2),
        "is_high": is_high
    }
    return render_template('activity.html', result=result)

if __name__ == '__main__':
    app.run(debug=True, port=5001)