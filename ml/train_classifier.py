#!/usr/bin/env python3
"""
Stock Buy/Hold/Sell Classifier Trainer

Trains a small neural network to classify stocks as BUY/HOLD/SELL
based on fundamental and technical features, then exports to TFLite.

Usage:
    pip install -r requirements.txt
    python train_classifier.py
"""

import os
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf

POOL = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'CRM',
    'ORCL', 'ADBE', 'KO', 'PEP', 'WMT', 'COST', 'MCD', 'NKE', 'DIS',
    'BA', 'CAT', 'GE', 'GS', 'MS', 'BAC', 'JPM', 'V', 'MA', 'AXP',
    'T', 'VZ', 'CMCSA', 'PM', 'MDT', 'BMY', 'GILD', 'AMGN', 'TXN',
    'QCOM', 'AVGO', 'NOW', 'INTU', 'MU', 'AMAT', 'UBER', 'IBM',
    'SHOP', 'SQ', 'PYPL', 'SE', 'PLTR', 'COIN', 'HOOD', 'SNOW',
    'PANW', 'CRWD', 'NET', 'DDOG', 'MDB', 'ZS', 'OKTA', 'TWLO',
    'MRNA', 'VRTX', 'REGN', 'ILMN', 'ISRG', 'UNH', 'ABBV', 'LLY',
    'MRK', 'PFE', 'ABT', 'NFLX', 'SPGI', 'BLK', 'SCHW', 'ICE',
    'FDX', 'UPS', 'LUV', 'DAL', 'RCL', 'CCL', 'MGM', 'LVS',
    'MAR', 'HLT', 'AZO', 'ORLY', 'ROST', 'BBY', 'DG', 'DLTR',
    'CMG', 'SBUX', 'MELI', 'CPRT', 'FAST', 'PAYX', 'CTAS',
    'SNPS', 'CDNS', 'FTNT', 'ANSS', 'WDAY', 'TEAM', 'TTD', 'HUBS',
    'GDDY', 'SMAR', 'FIVN', 'STNE', 'PAGS', 'NU', 'SOFI', 'UPST',
    'F', 'GM', 'IBM', 'CSCO', 'TMO', 'SYK', 'BSX', 'ZBH',
]

FEATURE_NAMES = [
    'pe_ratio',
    'fcf_yield',
    'revenue_growth',
    'profit_margin',
    'rsi_14',
    'dist_52w_high',
    'volume_ratio',
    'change_5d',
    'log_market_cap',
    'debt_to_equity',
]


def compute_rsi(prices, period=14):
    """Compute RSI from price series."""
    if len(prices) < period + 1:
        return 50.0
    deltas = prices.diff().dropna()
    gains = deltas.clip(lower=0)
    losses = -deltas.clip(upper=0)
    avg_gain = gains.rolling(window=period).mean().iloc[-1]
    avg_loss = losses.rolling(window=period).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def fetch_stock_features(symbol, end_date):
    """Fetch features for a stock at a given date."""
    try:
        start = end_date - timedelta(days=400)
        hist = yf.download(symbol, start=start.strftime('%Y-%m-%d'),
                          end=end_date.strftime('%Y-%m-%d'),
                          progress=False, auto_adjust=True)
        if hist.empty or len(hist) < 60:
            return None

        closes = hist['Close'].squeeze()
        volumes = hist['Volume'].squeeze()

        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        pe_ratio = info.get('trailingPE') or info.get('forwardPE') or 0
        if pe_ratio and pe_ratio < 0:
            pe_ratio = 0

        market_cap = info.get('marketCap') or 0
        fcf = info.get('freeCashflow') or 0
        fcf_yield = (fcf / market_cap * 100) if market_cap > 0 else 0

        revenue_growth = (info.get('revenueGrowth') or 0) * 100
        profit_margin = (info.get('profitMargins') or 0) * 100
        debt_to_equity = info.get('debtToEquity') or 0

        current_price = float(closes.iloc[-1])
        high_52w = float(closes.max())
        low_52w = float(closes.min())
        week_range = high_52w - low_52w
        dist_52w_high = ((high_52w - current_price) / week_range * 100) if week_range > 0 else 50

        avg_vol_20 = float(volumes.tail(20).mean()) if len(volumes) >= 20 else float(volumes.mean())
        current_vol = float(volumes.iloc[-1])
        volume_ratio = (current_vol / avg_vol_20) if avg_vol_20 > 0 else 1.0

        price_5d_ago = float(closes.iloc[-6]) if len(closes) >= 6 else float(closes.iloc[0])
        change_5d = ((current_price - price_5d_ago) / price_5d_ago * 100) if price_5d_ago > 0 else 0

        log_market_cap = np.log10(market_cap) if market_cap > 0 else 0

        rsi = compute_rsi(closes)

        features = {
            'pe_ratio': pe_ratio if pe_ratio else 0,
            'fcf_yield': fcf_yield,
            'revenue_growth': revenue_growth,
            'profit_margin': profit_margin,
            'rsi_14': rsi,
            'dist_52w_high': dist_52w_high,
            'volume_ratio': volume_ratio,
            'change_5d': change_5d,
            'log_market_cap': log_market_cap,
            'debt_to_equity': debt_to_equity,
        }

        future_price = None
        if len(closes) >= 22:
            future_price = float(closes.iloc[-22])
        elif len(closes) >= 15:
            future_price = float(closes.iloc[-15])

        return {
            'features': features,
            'current_price': current_price,
            'future_price': future_price,
        }

    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return None


def create_label(current_price, future_price):
    """Create BUY/HOLD/SELL label based on forward return."""
    if future_price is None or current_price <= 0:
        return None
    pct_change = (future_price - current_price) / current_price * 100
    if pct_change > 5:
        return 0  # BUY
    elif pct_change < -5:
        return 2  # SELL
    else:
        return 1  # HOLD


def collect_data():
    """Collect training data from Yahoo Finance."""
    print("=" * 60)
    print("STOCK CLASSIFIER - Data Collection")
    print("=" * 60)

    all_features = []
    all_labels = []

    historical_dates = []
    today = datetime.now()
    for months_back in range(6, 18, 3):
        date = today - timedelta(days=months_back * 30)
        historical_dates.append(date)

    for date in historical_dates:
        print(f"\n--- Collecting data for {date.strftime('%Y-%m-%d')} ---")
        for symbol in POOL:
            data = fetch_stock_features(symbol, date)
            if data is None:
                continue

            label = create_label(data['current_price'], data['future_price'])
            if label is None:
                continue

            feature_vector = [data['features'][k] for k in FEATURE_NAMES]
            all_features.append(feature_vector)
            all_labels.append(label)
            print(f"  {symbol}: label={['BUY','HOLD','SELL'][label]}")

    return np.array(all_features), np.array(all_labels)


def build_model(input_dim):
    """Build a small neural network classifier."""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dropout(0.1),
        tf.keras.layers.Dense(3, activation='softmax'),
    ])
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy'],
    )
    return model


def train(features, labels):
    """Train the model and export to TFLite."""
    print("\n" + "=" * 60)
    print("TRAINING")
    print("=" * 60)

    print(f"\nDataset: {len(features)} samples")
    print(f"Features: {features.shape[1]}")
    print(f"Labels: BUY={np.sum(labels==0)}, HOLD={np.sum(labels==1)}, SELL={np.sum(labels==2)}")

    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    X_train, X_test, y_train, y_test = train_test_split(
        features_scaled, labels, test_size=0.2, random_state=42, stratify=labels
    )

    model = build_model(features.shape[1])
    model.summary()

    model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=16,
        validation_data=(X_test, y_test),
        verbose=1,
    )

    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
    print(f"\nTest Accuracy: {test_acc:.4f}")
    print(f"Test Loss: {test_loss:.4f}")

    print("\nConverting to TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()

    output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'stock_classifier.tflite')

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"Model saved to: {output_path}")
    print(f"Model size: {len(tflite_model)} bytes ({len(tflite_model)/1024:.1f} KB)")

    scaler_path = os.path.join(os.path.dirname(__file__), 'scaler_params.json')
    import json
    scaler_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'feature_names': FEATURE_NAMES,
    }
    with open(scaler_path, 'w') as f:
        json.dump(scaler_params, f, indent=2)
    print(f"Scaler params saved to: {scaler_path}")

    return model, scaler


def main():
    features, labels = collect_data()

    if len(features) < 50:
        print(f"\nWarning: Only {len(features)} samples collected. Need at least 50.")
        print("Generating synthetic augmentation to improve training...")

        synthetic_features = []
        synthetic_labels = []

        for _ in range(200):
            idx = np.random.randint(0, len(features))
            noise = np.random.normal(0, 0.05, features.shape[1])
            synth = features[idx] + noise
            synthetic_features.append(synth)
            synthetic_labels.append(labels[idx])

        features = np.vstack([features, np.array(synthetic_features)])
        labels = np.concatenate([labels, np.array(synthetic_labels)])
        print(f"Augmented dataset: {len(features)} samples")

    train(features, labels)
    print("\nDone!")


if __name__ == '__main__':
    main()
