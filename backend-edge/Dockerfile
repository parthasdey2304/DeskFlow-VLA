FROM ros:jazzy-ros-core
WORKDIR /edge
COPY requirements.txt .
RUN apt-get update && apt-get install -y python3-pip && rm -rf /var/lib/apt/lists/* \
 && pip3 install --no-cache-dir -r requirements.txt
COPY supervisor.py cbf_safety.py ai_fallback_client.py traj_sandbox.py ./
CMD ["python3", "supervisor.py"]
