# Neural Network Architectures

This repository is organized by type of neural network, each in its dedicated folder. The goal is to explore and compare different architectures, from biologically inspired spiking models to classical deep learning frameworks.

## Overview of Architectures

### 🧠 Artificial Neural Networks (ANN)

ANNs are the core of modern machine learning. They consist of layers of neurons with continuous activation functions, trained via backpropagation. They are versatile and can be used for classification, regression, and more.

### 🔷 Multi-Layer Perceptrons (MLP)

MLPs are a subtype of ANN composed of fully connected layers. They are simple yet powerful and often serve as a baseline for comparison. While limited for spatial or sequential tasks, they work well for structured tabular data and function approximation.

### 🔁 Recurrent Neural Networks (RNN)

RNNs are designed for sequential data. They maintain a memory of previous inputs and are ideal for tasks like text generation, time series prediction, and speech recognition. LSTM and GRU are popular RNN variants.

### 🧩 Convolutional Neural Networks (CNN)

CNNs are tailored for spatial data such as images. They use convolutional layers to extract local features and are widely used in computer vision tasks like image classification, object detection, and segmentation.

### ⚡ Spiking Neural Networks (SNN)

SNNs mimic the behavior of biological neurons by using discrete spikes instead of continuous activations. They are well-suited for temporal and event-based data, and can be implemented efficiently on neuromorphic hardware.


---

Each folder contains a `README.md` describing the theory behind the architecture. Implementations, tests, and datasets are organized accordingly.
